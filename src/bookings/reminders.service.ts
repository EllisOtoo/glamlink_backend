import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';
import { BookingEventsService } from '../events/booking-events.service';

type ReminderStage = '24h' | '2h';

interface ReminderStageConfig {
  stage: ReminderStage;
  hoursAhead: number;
  field: 'reminder24hSentAt' | 'reminder2hSentAt';
}

@Injectable()
export class BookingRemindersService {
  private readonly logger = new Logger(BookingRemindersService.name);
  private readonly remindersEnabled: boolean;
  private readonly stageConfigs: ReminderStageConfig[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingEvents: BookingEventsService,
    private readonly configService: ConfigService,
  ) {
    this.remindersEnabled = this.readBooleanConfig(
      'ENABLE_WHATSAPP_BOOKING_REMINDERS',
      true,
    );
    this.stageConfigs = [
      {
        stage: '24h',
        hoursAhead: this.readNumberConfig(
          'BOOKING_REMINDER_24H_HOURS_AHEAD',
          24,
        ),
        field: 'reminder24hSentAt',
      },
      {
        stage: '2h',
        hoursAhead: this.readNumberConfig('BOOKING_REMINDER_2H_HOURS_AHEAD', 2),
        field: 'reminder2hSentAt',
      },
    ];
  }

  @Cron(CronExpression.EVERY_15_MINUTES)
  async handleScheduledReminders() {
    if (!this.remindersEnabled) {
      this.logger.debug('Booking reminders are disabled by configuration.');
      return;
    }

    await this.sendUpcomingReminders('all');
  }

  async sendUpcomingReminders(stage: ReminderStage | 'all' = 'all') {
    const activeStages =
      stage === 'all'
        ? this.stageConfigs
        : this.stageConfigs.filter((config) => config.stage === stage);

    const results = await Promise.all(
      activeStages.map((config) => this.sendReminderStage(config)),
    );

    return {
      remindersSent: results.reduce((sum, result) => sum + result.sent, 0),
      stages: results.map((result) => ({
        stage: result.stage,
        remindersSent: result.sent,
      })),
    };
  }

  private async sendReminderStage(config: ReminderStageConfig) {
    const now = new Date();
    const windowEnd = new Date(
      now.getTime() + config.hoursAhead * 60 * 60 * 1000,
    );

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        [config.field]: null,
        scheduledStart: {
          gte: now,
          lte: windowEnd,
        },
      } as Prisma.BookingWhereInput,
    });

    if (bookings.length === 0) {
      return { stage: config.stage, sent: 0 };
    }

    let sent = 0;

    for (const booking of bookings) {
      const updated = await this.prisma.booking.update({
        where: { id: booking.id },
        data: { [config.field]: new Date() },
      });

      this.bookingEvents.emitReminder(updated, {
        reminderStage: config.stage,
        hoursAhead: config.hoursAhead,
      });
      sent += 1;
    }

    this.logger.log(
      `Sent ${sent} booking reminders for stage ${config.stage}.`,
    );
    return { stage: config.stage, sent };
  }

  private readBooleanConfig(key: string, fallback: boolean) {
    const raw = this.configService.get<string | boolean>(key);
    if (raw === undefined) {
      return fallback;
    }
    return raw === true || raw === 'true';
  }

  private readNumberConfig(key: string, fallback: number) {
    const raw = this.configService.get<string>(key);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
