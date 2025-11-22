import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { VerifiedVendorGuard } from './guards/verified-vendor.guard';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  providers: [VendorsService, VerifiedVendorGuard],
  controllers: [VendorsController],
  exports: [VendorsService, VerifiedVendorGuard],
})
export class VendorsModule {}
