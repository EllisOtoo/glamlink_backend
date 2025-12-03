import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { ServicesModule } from '../services/services.module';
import { PaymentsModule } from '../payments/payments.module';
import { BookingEventsModule } from '../events/booking-events.module';
import { AuthModule } from '../auth/auth.module';
import { CalendarModule } from '../calendar/calendar.module';
import { CustomerProfilesModule } from '../customer-profiles/customer-profiles.module';
import { BookingsService } from './bookings.service';
import { PublicBookingsController } from './public-bookings.controller';
import { BookingsController } from './bookings.controller';
import { BookingRemindersService } from './reminders.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { GiftCardsModule } from '../gift-cards/gift-cards.module';

@Module({
  imports: [
    PrismaModule,
    ServicesModule,
    PaymentsModule,
    BookingEventsModule,
    AuthModule,
    CalendarModule,
    CustomerProfilesModule,
    PlatformSettingsModule,
    GiftCardsModule,
  ],
  controllers: [PublicBookingsController, BookingsController],
  providers: [BookingsService, BookingRemindersService],
  exports: [BookingsService],
})
export class BookingsModule {}
