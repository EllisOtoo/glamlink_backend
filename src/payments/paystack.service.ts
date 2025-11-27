import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import {
  Prisma,
  BookingStatus,
  PaymentStatus,
  Booking,
  PaymentIntent,
  SupplyOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma';
import { BookingEventsService } from '../events/booking-events.service';
import { CalendarService } from '../calendar/calendar.service';

export interface PaystackCheckoutPayload {
  publicKey: string;
  reference: string;
  amountPesewas: number;
  currency: string;
  email: string;
  // Restrict Paystack UI to channels we want to present (e.g., Ghana mobile money)
  channels?: string[];
  metadata: Record<string, unknown>;
}

export interface PaystackWebhookEvent {
  event: string;
  data?: {
    reference?: string;
    amount?: number;
    currency?: string;
    status?: string;
    paidAt?: string;
    metadata?: Record<string, unknown>;
    channel?: string;
  };
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly bookingEvents: BookingEventsService,
    private readonly calendarService: CalendarService,
  ) {}

  getPublicKey(): string {
    return this.configService.get<string>('PAYSTACK_PUBLIC_KEY', '');
  }

  private getSecretKey(): string {
    return this.configService.get<string>('PAYSTACK_SECRET_KEY', '');
  }

  buildCheckoutPayload(params: {
    booking: Booking & { paymentIntent: PaymentIntent | null };
  }): PaystackCheckoutPayload | null {
    const { booking } = params;
    if (!booking.paymentIntent) {
      return null;
    }

    if (!booking.customerEmail) {
      this.logger.warn(
        `Booking ${booking.id} is missing customerEmail; Paystack checkout will default to placeholder.`,
      );
    }

    return {
      publicKey: this.getPublicKey(),
      reference: booking.paymentIntent.providerRef,
      amountPesewas: booking.paymentIntent.amountPesewas,
      currency: booking.paymentIntent.currency,
      email: booking.customerEmail ?? 'no-email@glamlink.app',
      channels: this.buildChannels(booking.paymentIntent.currency),
      metadata: {
        bookingId: booking.id,
        vendorId: booking.vendorId,
        serviceId: booking.serviceId,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
      },
    };
  }

  private buildChannels(currency: string): string[] | undefined {
    const normalized = currency.toUpperCase();
    if (normalized === 'GHS') {
      // Ensure Ghana mobile money options (MTN, AirtelTigo, Vodafone) appear in the Paystack checkout
      return ['mobile_money', 'card'];
    }

    return undefined;
  }

  verifySignature(
    signature: string | undefined,
    rawBody: Buffer | undefined,
  ): boolean {
    if (!signature || !rawBody) {
      return false;
    }

    const secret = this.getSecretKey();
    if (!secret) {
      this.logger.warn(
        'PAYSTACK_SECRET_KEY is not configured; rejecting webhook.',
      );
      return false;
    }

    const computed = createHmac('sha512', secret).update(rawBody).digest('hex');

    return computed === signature;
  }

  async handleWebhook(payload: PaystackWebhookEvent): Promise<void> {
    if (!payload || typeof payload.event !== 'string') {
      this.logger.warn('Received malformed Paystack webhook payload.');
      return;
    }

    switch (payload.event) {
      case 'charge.success':
        await this.handleChargeSuccess(payload);
        break;
      case 'charge.failed':
      case 'charge.reversed':
        await this.handleChargeFailure(payload);
        break;
      default:
        this.logger.debug(
          `Ignoring unsupported Paystack event: ${payload.event}`,
        );
    }
  }

  private async handleChargeSuccess(
    payload: PaystackWebhookEvent,
  ): Promise<void> {
    const data = payload.data;
    if (!data?.reference || typeof data.amount !== 'number') {
      this.logger.warn('charge.success missing reference or amount.');
      return;
    }

    const currency = (data.currency ?? 'GHS').toUpperCase();
    let confirmedBooking: Booking | null = null;
    let failedBooking: { booking: Booking; reason: string } | null = null;
    let supplyOrderId: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const paymentIntent = await tx.paymentIntent.findUnique({
        where: { providerRef: data.reference },
        include: { booking: true, supplyOrder: true },
      });

      if (!paymentIntent) {
        this.logger.warn(
          `Paystack reference ${data.reference} not recognised.`,
        );
        return;
      }

      if (paymentIntent.status === PaymentStatus.SUCCEEDED) {
        this.logger.log(
          `Paystack reference ${data.reference} already marked as succeeded. Ignoring duplicate.`,
        );
        return;
      }

      if (paymentIntent.amountPesewas !== data.amount) {
        this.logger.warn(
          `Paystack amount mismatch for reference ${data.reference} (expected ${paymentIntent.amountPesewas}, got ${data.amount}).`,
        );
        const failure = await this.markIntentFailure(
          tx,
          paymentIntent,
          'Amount mismatch',
        );
        if (failure?.booking) {
          failedBooking = {
            booking: failure.booking,
            reason: 'Amount mismatch',
          };
        }
        return;
      }

      if (currency !== paymentIntent.currency.toUpperCase()) {
        this.logger.warn(
          `Paystack currency mismatch for reference ${data.reference} (expected ${paymentIntent.currency}, got ${currency}).`,
        );
        const failure = await this.markIntentFailure(
          tx,
          paymentIntent,
          'Currency mismatch',
        );
        if (failure?.booking) {
          failedBooking = {
            booking: failure.booking,
            reason: 'Currency mismatch',
          };
        }
        return;
      }

      await tx.paymentIntent.update({
        where: { id: paymentIntent.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          confirmedAt: new Date(),
          metadata: this.mergeMetadata(paymentIntent.metadata, {
            paystackStatus: data.status,
            channel: data.channel ?? null,
            paidAt: data.paidAt ?? null,
          }),
        },
      });

      if (paymentIntent.booking) {
        confirmedBooking = await tx.booking.update({
          where: { id: paymentIntent.bookingId! },
          data: {
            status: BookingStatus.CONFIRMED,
          },
        });
      } else if (paymentIntent.supplyOrder) {
        await tx.supplyOrder.update({
          where: { id: paymentIntent.supplyOrder.id },
          data: {
            status: 'WAITING_ON_SUPPLIER',
            history: {
              create: {
                fromStatus: paymentIntent.supplyOrder.status,
                toStatus: 'WAITING_ON_SUPPLIER',
                note: 'Payment confirmed via Paystack.',
              },
            },
          },
        });
        supplyOrderId = paymentIntent.supplyOrder.id;
      }
    });

    if (failedBooking) {
      const { booking, reason } = failedBooking as {
        booking: Booking;
        reason: string;
      };
      this.bookingEvents.emitPaymentFailed(booking, reason, {
        slotReleased: booking.status === BookingStatus.CANCELLED,
      });
      await this.calendarService.syncEntriesForBooking(booking);
      return;
    }

    if (confirmedBooking) {
      this.bookingEvents.emitConfirmed(confirmedBooking, {
        paystackReference: data.reference,
        paidAt: data.paidAt ?? null,
        channel: data.channel ?? null,
      });
      await this.calendarService.syncEntriesForBooking(confirmedBooking);
    } else if (supplyOrderId) {
      this.logger.log(
        `Supply order ${supplyOrderId} payment succeeded for reference ${data.reference}.`,
      );
    }
  }

  private async handleChargeFailure(
    payload: PaystackWebhookEvent,
  ): Promise<void> {
    const data = payload.data;
    if (!data?.reference) {
      this.logger.warn('Paystack failure event missing reference.');
      return;
    }

    let affectedBooking: Booking | null = null;
    let affectedSupplyOrderId: string | null = null;
    const failureReason = `Paystack reported ${payload.event}`;
    await this.prisma.$transaction(async (tx) => {
      const paymentIntent = await tx.paymentIntent.findUnique({
        where: { providerRef: data.reference },
        include: { booking: true, supplyOrder: true },
      });

      if (!paymentIntent) {
        this.logger.warn(
          `Failure event reference not recognised: ${data.reference}`,
        );
        return;
      }

      const result = await this.markIntentFailure(
        tx,
        paymentIntent,
        failureReason,
      );
      if (result?.booking) {
        affectedBooking = result.booking;
      }
      if (result?.supplyOrderId) {
        affectedSupplyOrderId = result.supplyOrderId;
      }
    });

    if (affectedBooking) {
      const booking = affectedBooking as Booking;
      this.bookingEvents.emitPaymentFailed(booking, failureReason, {
        slotReleased: booking.status === BookingStatus.CANCELLED,
      });
      await this.calendarService.syncEntriesForBooking(booking);
    }

    if (affectedSupplyOrderId) {
      this.logger.warn(
        `Supply order ${affectedSupplyOrderId} marked as failed for reference ${data.reference}`,
      );
    }
  }

  private async markIntentFailure(
    tx: Prisma.TransactionClient,
    paymentIntent: PaymentIntent & { booking: Booking | null; supplyOrder?: { id: string; status: SupplyOrderStatus } | null },
    reason: string,
  ): Promise<{ booking: Booking | null; supplyOrderId?: string } | null> {
    await tx.paymentIntent.update({
      where: { id: paymentIntent.id },
      data: {
        status: PaymentStatus.FAILED,
        lastError: reason,
      },
    });

    if (
      paymentIntent.booking &&
      (paymentIntent.booking.status === BookingStatus.AWAITING_PAYMENT ||
        paymentIntent.booking.status === BookingStatus.PENDING)
    ) {
      const booking = await tx.booking.update({
        where: { id: paymentIntent.bookingId! },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });
      return { booking };
    }

    if (
      paymentIntent.supplyOrder &&
      paymentIntent.supplyOrder.status === 'REQUIRES_PAYMENT'
    ) {
      await tx.supplyOrder.update({
        where: { id: paymentIntent.supplyOrder.id },
        data: {
          status: 'CANCELLED',
          history: {
            create: {
              fromStatus: paymentIntent.supplyOrder.status,
              toStatus: 'CANCELLED',
              note: reason,
            },
          },
        },
      });
      return { booking: null, supplyOrderId: paymentIntent.supplyOrder.id };
    }

    return { booking: paymentIntent.booking ?? null };
  }

  private mergeMetadata(
    existing: Prisma.JsonValue | null,
    patch: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? (existing as Record<string, unknown>)
        : {};
    return { ...base, ...patch } as Prisma.InputJsonValue;
  }
}
