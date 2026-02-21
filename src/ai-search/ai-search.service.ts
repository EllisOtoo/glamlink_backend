import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { QueryParserService } from './query-parser.service';
import { AiSearchRequestDto, AiSearchResponse, ParsedQuery } from './ai-search.dto';

@Injectable()
export class AiSearchService {
  private readonly logger = new Logger(AiSearchService.name);

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
    private queryParserService: QueryParserService,
  ) {}

  async search(dto: AiSearchRequestDto, signal?: AbortSignal): Promise<AiSearchResponse> {
    let parsedQuery: ParsedQuery;

    if (signal?.aborted) throw new Error('Request aborted');

    // 1. Parse or retrieve from token
    if (dto.parsedQueryToken) {
      try {
        parsedQuery = JSON.parse(Buffer.from(dto.parsedQueryToken, 'base64').toString('utf-8'));
      } catch (e) {
        parsedQuery = await this.queryParserService.parseQuery(dto.query);
      }
    } else {
      parsedQuery = await this.queryParserService.parseQuery(dto.query);
    }

    if (signal?.aborted) throw new Error('Request aborted');

    // 2. Generate Embedding
    let intentText = parsedQuery.serviceIntent || dto.query;
    if (parsedQuery.location) {
      intentText += ` in ${parsedQuery.location}`;
    }
    const embedding = await this.embeddingService.generateEmbedding(intentText);
      const vectorString = this.embeddingService.formatVector(embedding);
  
      if (signal?.aborted) throw new Error('Request aborted');
  
      // 3. Database Search with Hybrid Filters (Vector Similarity + Location)
      
      // For MVP, we pass the location into the embedding text rather than a hard SQL filter
      // because dev data might not perfectly align with parsed neighborhoods.
      let locationFilter = '';
      // We still have the variable for future PostGIS implementations
  
      const limit = dto.limit ?? 10;
      const offset = dto.offset ?? 0;
  
      const query = `
        SELECT 
          s.id as "serviceId",
          s.name as "serviceName",
          s."priceCents",
          s."durationMinutes",
          s."ratingAverage" as rating,
          s."ratingCount" as "reviewCount",
          v.id as "vendorId",
          v."businessName" as "vendorName",
          v.handle as "vendorHandle",
          v."logoStorageKey" as "vendorAvatar",
          1 - (s."searchEmbedding" <=> '${vectorString}'::vector) as similarity
        FROM "Service" s
        JOIN "Vendor" v ON s."vendorId" = v.id
        WHERE s."isActive" = true
          AND v.status NOT IN ('SUSPENDED', 'REJECTED')
          AND s."searchEmbedding" IS NOT NULL
          ${locationFilter}
        ORDER BY s."searchEmbedding" <=> '${vectorString}'::vector
        LIMIT ${limit} OFFSET ${offset};
      `;
  
      const rawResults: any[] = await this.prisma.$queryRawUnsafe(query);
  
      if (signal?.aborted) throw new Error('Request aborted');
  
      // 4. Map results and generate pseudo-slots (real avail checks would go here)
      const results = rawResults.map(r => ({
        id: r.serviceId,
        vendorId: r.vendorId,
        vendorName: r.vendorName,
        vendorHandle: r.vendorHandle,
        vendorAvatar: r.vendorAvatar,
        serviceName: r.serviceName,
        priceCents: r.priceCents,
        durationMinutes: r.durationMinutes,
        distanceKm: null,
        rating: r.rating || 0,
        reviewCount: r.reviewCount || 0,
        similarityScore: Math.round(r.similarity * 100),
        availableSlots: this.generateMockSlots(parsedQuery),
      }));
  
      return {
        parsedQuery,
        parsedQueryToken: Buffer.from(JSON.stringify(parsedQuery)).toString('base64'),
        results,
        totalEstimate: results.length === limit ? offset + limit + 1 : offset + results.length,
        hasMore: results.length === limit,
      };
    }
  
    private generateMockSlots(parsedQuery: ParsedQuery): string[] {
      const slots: string[] = [];
      let startHour = 9; // default 9am
    let maxSlots = 3;

    if (parsedQuery.timeRange) {
        startHour = Math.floor(parsedQuery.timeRange.start / 60);
    }

    for (let i = 0; i < maxSlots; i++) {
        const hour = Math.min(startHour + i, 20); // up to 8pm
        const min = i % 2 === 0 ? '00' : '30';
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        slots.push(`${h12}:${min} ${ampm}`);
    }
    return slots;
  }
}
