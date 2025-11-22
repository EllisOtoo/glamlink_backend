import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { BookingStatus } from '@prisma/client';
import { BookingEventsService } from '../events/booking-events.service';

@Injectable()
export class BookingRemindersService {
  private readonly logger = new Logger(BookingRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingEvents: BookingEventsService,
  ) {}

  async sendUpcomingReminders(hoursAhead = 24) {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        reminderSentAt: null,
        scheduledStart: {
          gte: now,
          lte: windowEnd,
        },
      },
    });

    if (bookings.length === 0) {
      return { remindersSent: 0 };
    }

    for (const booking of bookings) {
      const updated = await this.prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: new Date() },
      });

      this.bookingEvents.emitReminder(updated, { windowHours: hoursAhead });
    }

    this.logger.log(`Sent ${bookings.length} booking reminders.`);
    return { remindersSent: bookings.length };
  }
}
