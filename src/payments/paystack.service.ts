import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import {
  Prisma,
  BookingStatus,
  PaymentStatus,
  Booking,
  PaymentIntent,
} from '@prisma/client';
import { PrismaService } from '../prisma';

export interface PaystackCheckoutPayload {
  publicKey: string;
  reference: string;
  amountPesewas: number;
  currency: string;
  email: string;
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
      metadata: {
        bookingId: booking.id,
        vendorId: booking.vendorId,
        serviceId: booking.serviceId,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
      },
    };
  }

  verifySignature(signature: string | undefined, rawBody: Buffer | undefined): boolean {
    if (!signature || !rawBody) {
      return false;
    }

    const secret = this.getSecretKey();
    if (!secret) {
      this.logger.warn('PAYSTACK_SECRET_KEY is not configured; rejecting webhook.');
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
        this.logger.debug(`Ignoring unsupported Paystack event: ${payload.event}`);
    }
  }

  private async handleChargeSuccess(payload: PaystackWebhookEvent): Promise<void> {
    const data = payload.data;
    if (!data?.reference || typeof data.amount !== 'number') {
      this.logger.warn('charge.success missing reference or amount.');
      return;
    }

    const currency = (data.currency ?? 'GHS').toUpperCase();
    await this.prisma.$transaction(async (tx) => {
      const paymentIntent = await tx.paymentIntent.findUnique({
        where: { providerRef: data.reference },
        include: { booking: true },
      });

      if (!paymentIntent) {
        this.logger.warn(`Paystack reference ${data.reference} not recognised.`);
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
        await this.markIntentFailure(tx, paymentIntent.id, 'Amount mismatch');
        return;
      }

      if (currency !== paymentIntent.currency.toUpperCase()) {
        this.logger.warn(
          `Paystack currency mismatch for reference ${data.reference} (expected ${paymentIntent.currency}, got ${currency}).`,
        );
        await this.markIntentFailure(tx, paymentIntent.id, 'Currency mismatch');
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

      await tx.booking.update({
        where: { id: paymentIntent.bookingId },
        data: {
          status: BookingStatus.CONFIRMED,
        },
      });
    });
  }

  private async handleChargeFailure(payload: PaystackWebhookEvent): Promise<void> {
    const data = payload.data;
    if (!data?.reference) {
      this.logger.warn('Paystack failure event missing reference.');
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const paymentIntent = await tx.paymentIntent.findUnique({
        where: { providerRef: data.reference },
      });

      if (!paymentIntent) {
        this.logger.warn(`Failure event reference not recognised: ${data.reference}`);
        return;
      }

      await this.markIntentFailure(
        tx,
        paymentIntent.id,
        `Paystack reported ${payload.event}`,
      );
    });
  }

  private async markIntentFailure(
    tx: Prisma.TransactionClient,
    paymentIntentId: string,
    reason: string,
  ) {
    await tx.paymentIntent.update({
      where: { id: paymentIntentId },
      data: {
        status: PaymentStatus.FAILED,
        lastError: reason,
      },
    });
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
