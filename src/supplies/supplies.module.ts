import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth/auth.module';
import { SuppliesService } from './supplies.service';
import {
  AdminSuppliesController,
  PublicSuppliesController,
  VendorSuppliesController,
} from './supplies.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [
    AdminSuppliesController,
    PublicSuppliesController,
    VendorSuppliesController,
  ],
  providers: [SuppliesService],
  exports: [SuppliesService],
})
export class SuppliesModule {}
