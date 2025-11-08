import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { ServicesModule } from '../services/services.module';
import { PaymentsModule } from '../payments/payments.module';
import { BookingsService } from './bookings.service';
import { PublicBookingsController } from './public-bookings.controller';
import { VendorBookingsController } from './vendor-bookings.controller';

@Module({
  imports: [PrismaModule, ServicesModule, PaymentsModule],
  controllers: [PublicBookingsController, VendorBookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
