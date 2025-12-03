import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { PaymentsModule } from '../payments/payments.module';
import { AuthModule } from '../auth/auth.module';
import { GiftCardsService } from './gift-cards.service';
import { PublicGiftCardsController } from './public-gift-cards.controller';
import { GiftCardsController } from './gift-cards.controller';

@Module({
  imports: [PrismaModule, PaymentsModule, AuthModule],
  controllers: [PublicGiftCardsController, GiftCardsController],
  providers: [GiftCardsService],
  exports: [GiftCardsService],
})
export class GiftCardsModule {}
