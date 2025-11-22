import { Module } from '@nestjs/common';
import { BookingEventsService } from './booking-events.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [BookingEventsService],
  exports: [BookingEventsService],
})
export class BookingEventsModule {}
