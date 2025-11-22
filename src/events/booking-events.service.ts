import { Injectable, Logger } from '@nestjs/common';
import { Booking, BookingStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

export enum BookingEventType {
  CREATED = 'booking.created',
  AWAITING_PAYMENT = 'booking.awaiting_payment',
  CONFIRMED = 'booking.confirmed',
  PAYMENT_FAILED = 'booking.payment_failed',
  RESCHEDULED = 'booking.rescheduled',
  CANCELLED = 'booking.cancelled',
  REMINDER = 'booking.reminder',
}

export interface BookingDomainEvent {
  type: BookingEventType;
  bookingId: string;
  vendorId: string;
  serviceId: string;
  reference: string;
  status: BookingStatus;
  timestamp: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class BookingEventsService {
  private readonly logger = new Logger(BookingEventsService.name);

  constructor(private readonly notifications: NotificationsService) {}

  emit(event: BookingDomainEvent) {
    this.logger.log(
      `${event.type} | booking=${event.bookingId} vendor=${event.vendorId} service=${event.serviceId} status=${event.status}`,
    );
    this.logger.debug(
      `booking-event-payload=${JSON.stringify({
        ...event,
        timestamp: event.timestamp,
      })}`,
    );
    void this.notifications
      .handleBookingEvent(event)
      .catch((error) =>
        this.logger.error(
          `Failed to handle booking event notification for ${event.bookingId}`,
          error as Error,
        ),
      );
  }

  emitCreated(booking: Booking) {
    this.emit(this.buildEvent(BookingEventType.CREATED, booking));
  }

  emitAwaitingPayment(booking: Booking) {
    this.emit(this.buildEvent(BookingEventType.AWAITING_PAYMENT, booking));
  }

  emitConfirmed(booking: Booking, extras?: Record<string, unknown>) {
    this.emit(this.buildEvent(BookingEventType.CONFIRMED, booking, extras));
  }

  emitPaymentFailed(
    booking: Booking,
    reason: string,
    extras?: Record<string, unknown>,
  ) {
    this.emit(
      this.buildEvent(BookingEventType.PAYMENT_FAILED, booking, {
        reason,
        ...extras,
      }),
    );
  }

  emitRescheduled(booking: Booking, extras?: Record<string, unknown>) {
    this.emit(this.buildEvent(BookingEventType.RESCHEDULED, booking, extras));
  }

  emitCancelled(booking: Booking, extras?: Record<string, unknown>) {
    this.emit(this.buildEvent(BookingEventType.CANCELLED, booking, extras));
  }

  emitReminder(booking: Booking, extras?: Record<string, unknown>) {
    this.emit(this.buildEvent(BookingEventType.REMINDER, booking, extras));
  }

  private buildEvent(
    type: BookingEventType,
    booking: Booking,
    payload?: Record<string, unknown>,
  ): BookingDomainEvent {
    return {
      type,
      bookingId: booking.id,
      vendorId: booking.vendorId,
      serviceId: booking.serviceId,
      reference: booking.reference,
      status: booking.status,
      timestamp: new Date().toISOString(),
      payload,
    };
  }
}
