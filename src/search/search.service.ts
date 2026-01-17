import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async getSuggestions(query: string, limit = 5) {
    if (!query || query.length < 2) {
      return { suggestions: [] };
    }

    // Using raw SQL for Postgres-specific trigram similarity matching
    const suggestions: any[] = await this.prisma.$queryRaw`
      WITH search_results AS (
        SELECT 
          name as label, 
          'service' as type,
          id as "itemId",
          similarity(name, ${query}) as score
        FROM "Service"
        WHERE name % ${query} AND "isActive" = true
        
        UNION ALL
        
        SELECT 
          "businessName" as label, 
          'vendor' as type,
          id as "itemId",
          similarity("businessName", ${query}) as score
        FROM "Vendor"
        WHERE "businessName" % ${query} AND status = 'VERIFIED'

        UNION ALL

        SELECT 
          name as label,
          'category' as type,
          id as "itemId",
          similarity(name, ${query}) as score
        FROM "Category"
        WHERE name % ${query}
      )
      SELECT * FROM search_results
      ORDER BY score DESC
      LIMIT ${limit};
    `;

    return {
      suggestions: suggestions.map(s => ({
        label: s.label,
        type: s.type,
        itemId: s.itemId,
        score: s.score
      }))
    };
  }
}
