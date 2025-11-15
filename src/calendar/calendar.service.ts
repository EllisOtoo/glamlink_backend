import { Injectable, Logger } from '@nestjs/common';
import { Booking, CalendarOwnerType } from '@prisma/client';
import { PrismaService } from '../prisma';

type CalendarBookingShape = Pick<
  Booking,
  | 'id'
  | 'vendorId'
  | 'serviceId'
  | 'customerUserId'
  | 'scheduledStart'
  | 'scheduledEnd'
  | 'status'
>;

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncEntriesForBooking(booking: CalendarBookingShape): Promise<void> {
    try {
      await Promise.all([
        this.upsertVendorEntry(booking),
        this.syncCustomerEntry(booking),
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to sync calendar entries for booking ${booking.id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async syncEntriesForBookings(bookings: CalendarBookingShape[]): Promise<void> {
    for (const booking of bookings) {
      await this.syncEntriesForBooking(booking);
    }
  }

  private buildEntryPayload(booking: CalendarBookingShape) {
    return {
      serviceId: booking.serviceId,
      scheduledStart: booking.scheduledStart,
      scheduledEnd: booking.scheduledEnd,
      status: booking.status,
    };
  }

  private upsertVendorEntry(booking: CalendarBookingShape) {
    return this.prisma.bookingCalendarEntry.upsert({
      where: {
        bookingId_ownerType: {
          bookingId: booking.id,
          ownerType: CalendarOwnerType.VENDOR,
        },
      },
      update: {
        vendorId: booking.vendorId,
        ...this.buildEntryPayload(booking),
      },
      create: {
        bookingId: booking.id,
        ownerType: CalendarOwnerType.VENDOR,
        vendorId: booking.vendorId,
        ...this.buildEntryPayload(booking),
      },
    });
  }

  private async syncCustomerEntry(booking: CalendarBookingShape) {
    if (!booking.customerUserId) {
      await this.prisma.bookingCalendarEntry.deleteMany({
        where: {
          bookingId: booking.id,
          ownerType: CalendarOwnerType.CUSTOMER,
        },
      });
      return;
    }

    await this.prisma.bookingCalendarEntry.upsert({
      where: {
        bookingId_ownerType: {
          bookingId: booking.id,
          ownerType: CalendarOwnerType.CUSTOMER,
        },
      },
      update: {
        customerUserId: booking.customerUserId,
        ...this.buildEntryPayload(booking),
      },
      create: {
        bookingId: booking.id,
        ownerType: CalendarOwnerType.CUSTOMER,
        customerUserId: booking.customerUserId,
        ...this.buildEntryPayload(booking),
      },
    });
  }
}
