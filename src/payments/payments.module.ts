import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { PaystackService } from './paystack.service';
import { PaystackWebhookController } from './paystack-webhook.controller';
import { BookingEventsModule } from '../events/booking-events.module';
import { CalendarModule } from '../calendar/calendar.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    BookingEventsModule,
    CalendarModule,
    NotificationsModule,
  ],
  providers: [PaystackService],
  controllers: [PaystackWebhookController],
  exports: [PaystackService],
})
export class PaymentsModule {}
