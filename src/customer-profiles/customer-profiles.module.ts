import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { CustomerProfilesController } from './customer-profiles.controller';
import { CustomerProfilesService } from './customer-profiles.service';

@Module({
  imports: [PrismaModule, StorageModule, AuthModule],
  controllers: [CustomerProfilesController],
  providers: [CustomerProfilesService],
  exports: [CustomerProfilesService],
})
export class CustomerProfilesModule {}
