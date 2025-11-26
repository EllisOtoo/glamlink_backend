import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { StorageModule } from '../storage/storage.module';
import { PublicCatalogController } from './public.controller';
import { PublicCatalogService } from './public.service';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [PrismaModule, StorageModule, ServicesModule],
  controllers: [PublicCatalogController],
  providers: [PublicCatalogService],
})
export class PublicModule {}
