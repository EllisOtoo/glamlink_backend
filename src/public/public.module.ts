import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { StorageModule } from '../storage/storage.module';
import { PublicCatalogController } from './public.controller';
import { PublicCatalogService } from './public.service';
import { ServicesModule } from '../services/services.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    ServicesModule,
    PlatformSettingsModule,
    AuthModule,
  ],
  controllers: [PublicCatalogController],
  providers: [PublicCatalogService],
})
export class PublicModule {}
