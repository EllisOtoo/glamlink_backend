import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async getSuggestions(query: string, limit = 5) {
    if (!query || query.length < 2) {
      return { suggestions: [] };
    }

    // Using raw SQL for Postgres-specific trigram and word similarity matching.
    // word_similarity is better for partial word matches (e.g. "har" -> "Hair Styling")
    const suggestions: any[] = await this.prisma.$queryRaw`
      WITH search_results AS (
        SELECT 
          name as label, 
          'service' as type,
          id as "itemId",
          word_similarity(${query}, name) as score
        FROM "Service"
        WHERE (${query} <% name OR name % ${query}) AND "isActive" = true
        
        UNION ALL
        
        SELECT 
          "businessName" as label, 
          'vendor' as type,
          id as "itemId",
          word_similarity(${query}, "businessName") as score
        FROM "Vendor"
        WHERE (${query} <% "businessName" OR "businessName" % ${query}) AND status = 'VERIFIED'

        UNION ALL

        SELECT 
          name as label,
          'category' as type,
          id as "itemId",
          word_similarity(${query}, name) as score
        FROM "Category"
        WHERE (${query} <% name OR name % ${query})
      )
      SELECT * FROM search_results
      WHERE score > 0.2
      ORDER BY score DESC, label ASC
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
