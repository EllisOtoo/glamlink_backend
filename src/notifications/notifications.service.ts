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

interface BookingNotificationDetails {
  customerName: string;
  customerPhone: string | null;
  vendorBusinessName: string | null;
  serviceName: string;
  scheduledStart: Date;
}

type ReminderStage = '24h' | '2h';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expoPushEndpoint = 'https://exp.host/--/api/v2/push/send';
  private readonly transporter?: Transporter;
  private readonly pushNotificationsEnabled: boolean;
  private readonly fromAddress: string;
  private readonly whatsappAccessToken: string;
  private readonly whatsappPhoneNumberId: string;
  private readonly whatsappBookingConfirmationTemplateName: string;
  private readonly whatsappBookingReminder24hTemplateName: string;
  private readonly whatsappBookingReminder2hTemplateName: string;
  private readonly whatsappTemplateLanguage: string;
  private readonly bookingNotificationTimezone: string;

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
    const pushEnabled =
      this.configService.get<string | boolean>('ENABLE_PUSH_NOTIFICATIONS') ??
      true;
    this.pushNotificationsEnabled =
      pushEnabled === true || pushEnabled === 'true';
    this.whatsappAccessToken =
      this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') ?? '';
    this.whatsappPhoneNumberId =
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') ?? '';
    this.whatsappBookingConfirmationTemplateName =
      this.configService.get<string>(
        'WHATSAPP_BOOKING_CONFIRMATION_TEMPLATE',
      ) ?? 'appointment_confirmation_bookikeke';
    this.whatsappBookingReminder24hTemplateName =
      this.configService.get<string>(
        'WHATSAPP_BOOKING_REMINDER_24H_TEMPLATE',
      ) ?? 'appointment_reminder_bookikeke';
    this.whatsappBookingReminder2hTemplateName =
      this.configService.get<string>('WHATSAPP_BOOKING_REMINDER_2H_TEMPLATE') ??
      'appointment_reminder_bookikeke';
    this.whatsappTemplateLanguage =
      this.configService.get<string>('WHATSAPP_TEMPLATE_LANGUAGE_CODE') ??
      'en_US';
    this.bookingNotificationTimezone =
      this.configService.get<string>('BOOKING_NOTIFICATION_TIMEZONE') ??
      'Africa/Accra';

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

    const message = this.buildBookingMessage(event, booking.service.name);
    const bookingDetails = {
      customerName: booking.customerName,
      customerPhone: booking.customerPhone ?? null,
      vendorBusinessName: booking.vendor?.businessName ?? null,
      serviceName: booking.service.name,
      scheduledStart: booking.scheduledStart,
    };

    if (message && targets.size > 0) {
      await this.sendExpoPush([...targets], message);
    }

    await this.sendBookingWhatsappIfNeeded(event, bookingDetails);
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
    if (!this.pushNotificationsEnabled) {
      this.logger.debug('Push notifications are disabled by configuration.');
      return;
    }

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

  private async sendBookingWhatsappIfNeeded(
    event: BookingDomainEvent,
    details: BookingNotificationDetails,
  ) {
    if (
      event.type !== BookingEventType.CONFIRMED &&
      event.type !== BookingEventType.REMINDER
    ) {
      return;
    }

    if (event.status !== 'CONFIRMED') {
      return;
    }

    if (
      event.type === BookingEventType.CONFIRMED &&
      event.payload?.balancePaymentCompleted === true
    ) {
      return;
    }

    const recipient = this.normalizeWhatsappPhone(details.customerPhone);
    if (!recipient) {
      return;
    }

    if (!this.whatsappAccessToken || !this.whatsappPhoneNumberId) {
      this.logger.warn(
        'WhatsApp booking message skipped because Meta credentials are not configured.',
      );
      return;
    }

    const { formattedDate, formattedTime } = this.formatBookingSchedule(
      details.scheduledStart,
    );
    const templateName = this.resolveBookingWhatsappTemplate(event);
    if (!templateName) {
      return;
    }
    const templateParameters = this.buildBookingWhatsappParameters(
      event,
      details,
      formattedDate,
      formattedTime,
    );

    try {
      const response = await fetch(
        `https://graph.facebook.com/v22.0/${this.whatsappPhoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.whatsappAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: recipient,
            type: 'template',
            template: {
              name: templateName,
              language: {
                code: this.whatsappTemplateLanguage,
              },
              components: [
                {
                  type: 'body',
                  parameters: templateParameters,
                },
              ],
            },
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(
          `WhatsApp booking message failed for booking ${event.bookingId}: ${response.status} ${body}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp booking message for booking ${event.bookingId}`,
        error as Error,
      );
    }
  }

  private resolveBookingWhatsappTemplate(event: BookingDomainEvent) {
    if (event.type === BookingEventType.CONFIRMED) {
      return this.whatsappBookingConfirmationTemplateName;
    }

    const stage = this.parseReminderStage(event.payload?.reminderStage);
    if (stage === '24h') {
      return this.whatsappBookingReminder24hTemplateName;
    }
    if (stage === '2h') {
      return this.whatsappBookingReminder2hTemplateName;
    }

    this.logger.warn(
      `Skipping WhatsApp reminder for booking ${event.bookingId} because the reminder stage is missing or invalid.`,
    );
    return null;
  }

  private buildBookingWhatsappParameters(
    event: BookingDomainEvent,
    details: BookingNotificationDetails,
    formattedDate: string,
    formattedTime: string,
  ) {
    if (event.type === BookingEventType.CONFIRMED) {
      return [
        { type: 'text', text: details.customerName },
        {
          type: 'text',
          text: details.vendorBusinessName ?? 'your vendor',
        },
        { type: 'text', text: details.serviceName },
        { type: 'text', text: formattedDate },
        { type: 'text', text: formattedTime },
      ];
    }

    return [
      { type: 'text', text: details.customerName },
      {
        type: 'text',
        text: details.vendorBusinessName ?? 'your vendor',
      },
      { type: 'text', text: formattedDate },
      { type: 'text', text: formattedTime },
    ];
  }

  private parseReminderStage(value: unknown): ReminderStage | null {
    return value === '24h' || value === '2h' ? value : null;
  }

  private normalizeWhatsappPhone(phone: string | null): string | null {
    if (!phone) {
      return null;
    }

    const digits = phone.replace(/\D/g, '');
    if (!digits) {
      return null;
    }

    if (digits.startsWith('233') && digits.length >= 12) {
      return digits;
    }

    if (digits.startsWith('0') && digits.length === 10) {
      return `233${digits.slice(1)}`;
    }

    return digits;
  }

  private formatBookingSchedule(date: Date) {
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      timeZone: this.bookingNotificationTimezone,
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);

    const formattedTime = new Intl.DateTimeFormat('en-US', {
      timeZone: this.bookingNotificationTimezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);

    return { formattedDate, formattedTime };
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

    const amount = this.formatCurrency(payload.amountPesewas, payload.currency);
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
