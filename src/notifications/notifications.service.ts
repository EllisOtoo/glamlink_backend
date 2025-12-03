import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import {
  BookingDomainEvent,
  BookingEventType,
} from '../events/booking-events.service';
import type { PushPlatform } from '@prisma/client';

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expoPushEndpoint = 'https://exp.host/--/api/v2/push/send';
  private readonly transporter?: Transporter;
  private readonly fromAddress: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<string>('SMTP_PORT');
    const secure =
      this.configService.get<string | boolean>('SMTP_SECURE') ?? false;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');

    this.fromAddress =
      this.configService.get<string>('NOTIFICATIONS_FROM_EMAIL') ??
      this.configService.get<string>('OTP_FROM_EMAIL') ??
      'no-reply@glamlink.local';

    if (host && port) {
      const transportConfig: {
        host: string;
        port: number;
        secure: boolean;
        auth?: {
          user: string;
          pass: string;
        };
      } = {
        host,
        port: Number(port),
        secure: secure === true || secure === 'true',
      };

      if (user && pass) {
        transportConfig.auth = { user, pass };
      }

      this.transporter = createTransport(transportConfig);
    } else {
      this.logger.warn(
        'SMTP host/port not configured. Notifications email will be logged to console.',
      );
    }
  }

  async registerPushToken(userId: string, dto: RegisterPushTokenDto) {
    const platform: PushPlatform = dto.platform ?? 'EXPO';
    await this.prisma.pushToken.upsert({
      where: { token: dto.token },
      update: {
        userId,
        platform,
        deviceName: dto.deviceName ?? null,
        appVersion: dto.appVersion ?? null,
        lastRegisteredAt: new Date(),
      },
      create: {
        userId,
        token: dto.token,
        platform,
        deviceName: dto.deviceName ?? null,
        appVersion: dto.appVersion ?? null,
      },
    });
  }

  async handleBookingEvent(event: BookingDomainEvent) {
    switch (event.type) {
      case BookingEventType.CREATED:
      case BookingEventType.AWAITING_PAYMENT:
      case BookingEventType.CONFIRMED:
      case BookingEventType.PAYMENT_FAILED:
      case BookingEventType.RESCHEDULED:
      case BookingEventType.CANCELLED:
      case BookingEventType.REMINDER:
        await this.dispatchBookingNotification(event);
        break;
      default:
        break;
    }
  }

  private async dispatchBookingNotification(event: BookingDomainEvent) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: event.bookingId },
      include: {
        vendor: {
          select: {
            userId: true,
            businessName: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!booking) {
      this.logger.warn(
        `Booking ${event.bookingId} not found for notification.`,
      );
      return;
    }

    const targets = new Set<string>();
    if (booking.vendor?.userId) {
      const vendorTokens = await this.getTokensForUser(booking.vendor.userId);
      vendorTokens.forEach((token) => targets.add(token));
    }

    if (booking.customerUserId) {
      const customerTokens = await this.getTokensForUser(
        booking.customerUserId,
      );
      customerTokens.forEach((token) => targets.add(token));
    }

    if (targets.size === 0) {
      return;
    }

    const message = this.buildBookingMessage(event, booking.service.name);
    if (!message) {
      return;
    }

    await this.sendExpoPush([...targets], message);
  }

  private async getTokensForUser(userId: string): Promise<string[]> {
    const records = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    return records.map((record) => record.token);
  }

  private buildBookingMessage(
    event: BookingDomainEvent,
    serviceName: string,
  ): PushMessage | null {
    switch (event.type) {
      case BookingEventType.CREATED:
        return {
          title: 'New booking request',
          body: `Someone just requested ${serviceName}.`,
          data: { bookingId: event.bookingId, status: event.status },
        };
      case BookingEventType.AWAITING_PAYMENT:
        return {
          title: 'Deposit pending',
          body: `Awaiting deposit for ${serviceName}.`,
          data: { bookingId: event.bookingId, status: event.status },
        };
      case BookingEventType.CONFIRMED:
        return {
          title: 'Booking confirmed',
          body: `${serviceName} is locked in.`,
          data: { bookingId: event.bookingId, status: event.status },
        };
      case BookingEventType.PAYMENT_FAILED:
        return {
          title: 'Payment failed',
          body: `Deposit failed for ${serviceName}.`,
          data: {
            bookingId: event.bookingId,
            status: event.status,
            reason: event.payload?.reason ?? null,
          },
        };
      case BookingEventType.RESCHEDULED:
        return {
          title: 'Booking rescheduled',
          body: `${serviceName} was moved to a new time.`,
          data: {
            bookingId: event.bookingId,
            status: event.status,
            ...event.payload,
          },
        };
      case BookingEventType.CANCELLED:
        return {
          title: 'Booking cancelled',
          body: `${serviceName} was cancelled.`,
          data: {
            bookingId: event.bookingId,
            status: event.status,
            ...event.payload,
          },
        };
      case BookingEventType.REMINDER:
        return {
          title: 'Upcoming appointment',
          body: `${serviceName} starts soon. Get ready!`,
          data: {
            bookingId: event.bookingId,
            status: event.status,
            ...event.payload,
          },
        };
      default:
        return null;
    }
  }

  private async sendExpoPush(tokens: string[], message: PushMessage) {
    if (tokens.length === 0) {
      return;
    }

    const payloads = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: message.title,
      body: message.body,
      data: message.data ?? {},
    }));

    try {
      await fetch(this.expoPushEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payloads.length === 1 ? payloads[0] : payloads),
      });
    } catch (error) {
      this.logger.error(
        'Failed to send Expo push notification',
        error as Error,
      );
    }
  }

  async notifyReviewSubmitted(payload: {
    reviewId: string;
    vendorUserId: string;
    serviceName: string;
    rating: number;
  }) {
    await this.sendMessageToUsers([payload.vendorUserId], {
      title: 'New review received',
      body: `${payload.serviceName} was rated ${payload.rating}/5.`,
      data: { reviewId: payload.reviewId },
    });
  }

  async notifyReviewReplied(payload: {
    reviewId: string;
    customerUserId: string;
    serviceName: string;
  }) {
    await this.sendMessageToUsers([payload.customerUserId], {
      title: 'Vendor replied',
      body: `Your review for ${payload.serviceName} received a reply.`,
      data: { reviewId: payload.reviewId },
    });
  }

  async notifyGiftCardActivated(payload: {
    giftCardId: string;
    code: string;
    amountPesewas: number;
    currency: string;
    purchaserEmail: string;
    purchaserName: string;
    recipientEmail?: string | null;
    recipientName?: string | null;
    vendorName?: string | null;
  }) {
    const recipients = [
      payload.recipientEmail?.toLowerCase(),
      payload.purchaserEmail?.toLowerCase(),
    ].filter((value): value is string => !!value);

    if (recipients.length === 0) {
      this.logger.warn(
        `Gift card ${payload.giftCardId} activated but no email recipients found.`,
      );
      return;
    }

    const amount = this.formatCurrency(
      payload.amountPesewas,
      payload.currency,
    );
    const vendor = payload.vendorName ?? 'your GlamLink vendor';
    const subject = 'Your GlamLink gift card is ready';
    const lines = [
      `Hello ${payload.recipientName ?? 'there'},`,
      '',
      `You have a gift card worth ${amount} for ${vendor}.`,
      `Code: ${payload.code}`,
      '',
      'Use this code when booking to redeem it.',
      '',
      'Enjoy!',
    ];

    await this.sendEmail({
      to: recipients,
      subject,
      text: lines.join('\n'),
      html: `<p>${lines.join('<br/>')}</p>`,
    });
  }

  private async sendMessageToUsers(userIds: string[], message: PushMessage) {
    const tokenBatches = await Promise.all(
      userIds.map((userId) => this.getTokensForUser(userId)),
    );
    const tokens = tokenBatches.flat();
    await this.sendExpoPush(tokens, message);
  }

  async notifyOpsSupplyOrderPaid(payload: {
    orderId: string;
    vendorName?: string | null;
    totalCents?: number;
    deliveryFeeCents?: number | null;
  }) {
    const recipients = this.getOpsEmails();
    if (recipients.length === 0) {
      this.logger.warn(
        'Supply order paid email skipped; OPS_SUPPLY_EMAILS not configured.',
      );
      return;
    }

    const totalGhs =
      typeof payload.totalCents === 'number'
        ? (payload.totalCents / 100).toFixed(2)
        : null;
    const deliveryGhs =
      typeof payload.deliveryFeeCents === 'number'
        ? (payload.deliveryFeeCents / 100).toFixed(2)
        : null;

    const subject = `Supply order paid: ${payload.vendorName ?? payload.orderId}`;
    const lines = [
      `Order ID: ${payload.orderId}`,
      `Vendor: ${payload.vendorName ?? 'Unknown vendor'}`,
    ];
    if (totalGhs) {
      lines.push(`Total (vendor pay): GHS ${totalGhs}`);
    }
    if (deliveryGhs) {
      lines.push(`Delivery fee: GHS ${deliveryGhs}`);
    }
    lines.push('Status: WAITING_ON_SUPPLIER');

    await this.sendEmail({
      to: recipients,
      subject,
      text: lines.join('\n'),
      html: `<p>${lines.join('<br/>')}</p>`,
    });
  }

  private formatCurrency(amount: number, currency: string) {
    const normalized = currency.toUpperCase();
    if (!Number.isFinite(amount)) {
      return `${normalized} ${amount}`;
    }
    return `${normalized} ${(amount / 100).toFixed(2)}`;
  }

  private getOpsEmails(): string[] {
    return (this.configService.get<string>('OPS_SUPPLY_EMAILS') ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  private async sendEmail(payload: {
    to: string[];
    subject: string;
    text: string;
    html: string;
  }) {
    if (!payload.to || payload.to.length === 0) {
      return;
    }

    if (!this.transporter) {
      this.logger.log(
        `Email to ${payload.to.join(', ')} | ${payload.subject}\n${payload.text}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send notification email to ${payload.to.join(', ')}. Reason: ${reason}. Falling back to log.`,
      );
      this.logger.log(
        `Email to ${payload.to.join(', ')} | ${payload.subject}\n${payload.text}`,
      );
    }
  }
}
