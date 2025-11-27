import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { SupplyOrdersController } from './supply-orders.controller';
import { SupplyOrdersService } from './supply-orders.service';

@Module({
  imports: [PrismaModule, AuthModule, PaymentsModule],
  controllers: [SupplyOrdersController],
  providers: [SupplyOrdersService],
  exports: [SupplyOrdersService],
})
export class SupplyOrdersModule {}
