import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth/auth.module';
import { ReviewsService } from './reviews.service';
import { BookingReviewsController } from './booking-reviews.controller';
import { ReviewsController } from './reviews.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule, StorageModule],
  providers: [ReviewsService],
  controllers: [BookingReviewsController, ReviewsController],
})
export class ReviewsModule {}
