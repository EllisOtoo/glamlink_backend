import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VendorsModule } from './vendors/vendors.module';
import { ServicesModule } from './services/services.module';
import { PaymentsModule } from './payments/payments.module';
import { BookingsModule } from './bookings/bookings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PublicModule } from './public/public.module';
import { CustomerProfilesModule } from './customer-profiles/customer-profiles.module';
import { SuppliesModule } from './supplies/supplies.module';
import { SupplyOrdersModule } from './supply-orders/supply-orders.module';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';
import { GiftCardsModule } from './gift-cards/gift-cards.module';
import { PayoutsModule } from './payouts/payouts.module';
import { LocationsModule } from './locations/locations.module';
import { SearchModule } from './search/search.module';
import { AiSearchModule } from './ai-search/ai-search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    VendorsModule,
    ServicesModule,
    BookingsModule,
    PaymentsModule,
    NotificationsModule,
    ReviewsModule,
    PublicModule,
    CustomerProfilesModule,
    SuppliesModule,
    SupplyOrdersModule,
    PlatformSettingsModule,
    GiftCardsModule,
    PayoutsModule,
    LocationsModule,
    SearchModule,
    AiSearchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
