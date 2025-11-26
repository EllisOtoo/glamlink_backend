import { Injectable, Logger } from '@nestjs/common';
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

  constructor(private readonly prisma: PrismaService) {}

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

  private async sendMessageToUsers(userIds: string[], message: PushMessage) {
    const tokenBatches = await Promise.all(
      userIds.map((userId) => this.getTokensForUser(userId)),
    );
    const tokens = tokenBatches.flat();
    await this.sendExpoPush(tokens, message);
  }
}
