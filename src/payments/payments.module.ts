import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { PaystackService } from './paystack.service';
import { PaystackWebhookController } from './paystack-webhook.controller';
import { BookingEventsModule } from '../events/booking-events.module';

@Module({
  imports: [PrismaModule, BookingEventsModule],
  providers: [PaystackService],
  controllers: [PaystackWebhookController],
  exports: [PaystackService],
})
export class PaymentsModule {}
