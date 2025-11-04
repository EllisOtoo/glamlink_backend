import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth/auth.module';
import { VendorsModule } from '../vendors/vendors.module';
import { ServicesService } from './services.service';
import {
  VendorAvailabilityController,
  VendorServicesController,
} from './services.controller';

@Module({
  imports: [PrismaModule, AuthModule, VendorsModule],
  controllers: [VendorServicesController, VendorAvailabilityController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
