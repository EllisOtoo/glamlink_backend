import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { StorageModule } from '../storage/storage.module';
import { PublicCatalogController } from './public.controller';
import { PublicCatalogService } from './public.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [PublicCatalogController],
  providers: [PublicCatalogService],
})
export class PublicModule {}
