import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { ServicesModule } from '../services/services.module';
import { PaymentsModule } from '../payments/payments.module';
import { BookingEventsModule } from '../events/booking-events.module';
import { AuthModule } from '../auth/auth.module';
import { BookingsService } from './bookings.service';
import { PublicBookingsController } from './public-bookings.controller';
import { BookingsController } from './bookings.controller';

@Module({
  imports: [
    PrismaModule,
    ServicesModule,
    PaymentsModule,
    BookingEventsModule,
    AuthModule,
  ],
  controllers: [PublicBookingsController, BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
