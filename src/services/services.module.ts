import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth/auth.module';
import { VendorsModule } from '../vendors/vendors.module';
import { StorageModule } from '../storage/storage.module';
import { ServicesService } from './services.service';
import {
  VendorAvailabilityController,
  VendorServicesController,
} from './services.controller';

@Module({
  imports: [PrismaModule, AuthModule, VendorsModule, StorageModule],
  controllers: [VendorServicesController, VendorAvailabilityController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
