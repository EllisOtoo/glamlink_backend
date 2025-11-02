import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth/auth.module';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { VerifiedVendorGuard } from './guards/verified-vendor.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [VendorsService, VerifiedVendorGuard],
  controllers: [VendorsController],
  exports: [VendorsService, VerifiedVendorGuard],
})
export class VendorsModule {}
