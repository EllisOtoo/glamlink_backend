import { Module } from '@nestjs/common';
import { AiSearchController } from './ai-search.controller';
import { AiSearchService } from './ai-search.service';
import { EmbeddingService } from './embedding.service';
import { QueryParserService } from './query-parser.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [AiSearchController],
  providers: [AiSearchService, EmbeddingService, QueryParserService],
  exports: [AiSearchService, EmbeddingService],
})
export class AiSearchModule {}
