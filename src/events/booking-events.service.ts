import { Injectable, Logger } from '@nestjs/common';
import { Booking, BookingStatus } from '@prisma/client';

export enum BookingEventType {
  CREATED = 'booking.created',
  AWAITING_PAYMENT = 'booking.awaiting_payment',
  CONFIRMED = 'booking.confirmed',
  PAYMENT_FAILED = 'booking.payment_failed',
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
