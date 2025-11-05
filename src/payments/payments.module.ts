import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { PaystackService } from './paystack.service';
import { PaystackWebhookController } from './paystack-webhook.controller';

@Module({
  imports: [PrismaModule],
  providers: [PaystackService],
  controllers: [PaystackWebhookController],
  exports: [PaystackService],
})
export class PaymentsModule {}
