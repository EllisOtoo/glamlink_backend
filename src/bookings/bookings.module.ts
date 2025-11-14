import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { ServicesModule } from '../services/services.module';
import { PaymentsModule } from '../payments/payments.module';
import { BookingEventsModule } from '../events/booking-events.module';
import { BookingsService } from './bookings.service';
import { PublicBookingsController } from './public-bookings.controller';

@Module({
  imports: [PrismaModule, ServicesModule, PaymentsModule, BookingEventsModule],
  controllers: [PublicBookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
