import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth/auth.module';
import { SuppliesService } from './supplies.service';
import {
  AdminSuppliesController,
  VendorSuppliesController,
} from './supplies.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminSuppliesController, VendorSuppliesController],
  providers: [SuppliesService],
  exports: [SuppliesService],
})
export class SuppliesModule {}
