import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async getSuggestions(query: string, limit = 5) {
    if (!query || query.length < 2) {
      return { suggestions: [] };
    }

    // Sanitize query for SQL safety (Prisma handles this, but being explicit)
    const sanitizedQuery = query.trim();

    // Multi-strategy search:
    // 1. Prefix matching (ILIKE) - catches "har" → "Hair"
    // 2. Lowered threshold trigram matching (0.1) - fuzzy matches
    // Results are combined, de-duplicated, and ranked by match quality
    
    // Note: We use a transaction with increased timeout to set the threshold
    // The threshold is set per-transaction to avoid affecting other queries
    const suggestions: any[] = await this.prisma.$transaction(
      async (tx) => {
        // Lower the similarity threshold for this transaction only
        await tx.$executeRaw`SELECT set_config('pg_trgm.similarity_threshold', '0.1', true)`;
        
        return tx.$queryRaw`
          WITH prefix_matches AS (
            -- Tier 1: Exact prefix matches (highest priority)
            SELECT 
              name as label, 
              'service' as type,
              id as "itemId",
              1.0 as score,
              1 as tier
            FROM "Service"
            WHERE LOWER(name) LIKE LOWER(${sanitizedQuery}) || '%' AND "isActive" = true
            
            UNION ALL
            
            SELECT 
              "businessName" as label, 
              'vendor' as type,
              id as "itemId",
              1.0 as score,
              1 as tier
            FROM "Vendor"
            WHERE LOWER("businessName") LIKE LOWER(${sanitizedQuery}) || '%' AND status = 'VERIFIED'

            UNION ALL

            SELECT 
              name as label,
              'category' as type,
              id as "itemId",
              1.0 as score,
              1 as tier
            FROM "Category"
            WHERE LOWER(name) LIKE LOWER(${sanitizedQuery}) || '%'
          ),
          
          trigram_matches AS (
            -- Tier 2: Trigram similarity matches (with lowered threshold)
            SELECT 
              name as label, 
              'service' as type,
              id as "itemId",
              similarity(name, ${sanitizedQuery}) as score,
              2 as tier
            FROM "Service"
            WHERE name % ${sanitizedQuery} AND "isActive" = true
            
            UNION ALL
            
            SELECT 
              "businessName" as label, 
              'vendor' as type,
              id as "itemId",
              similarity("businessName", ${sanitizedQuery}) as score,
              2 as tier
            FROM "Vendor"
            WHERE "businessName" % ${sanitizedQuery} AND status = 'VERIFIED'

            UNION ALL

            SELECT 
              name as label,
              'category' as type,
              id as "itemId",
              similarity(name, ${sanitizedQuery}) as score,
              2 as tier
            FROM "Category"
            WHERE name % ${sanitizedQuery}
          ),

          combined AS (
            SELECT * FROM prefix_matches
            UNION ALL
            SELECT * FROM trigram_matches
          ),

          deduplicated AS (
            -- De-duplicate by itemId+type, keeping highest tier (prefix > trigram)
            SELECT DISTINCT ON ("itemId", type)
              label,
              type,
              "itemId",
              score,
              tier
            FROM combined
            ORDER BY "itemId", type, tier ASC, score DESC
          )

          SELECT label, type, "itemId", score
          FROM deduplicated
          ORDER BY tier ASC, score DESC
          LIMIT ${limit};
        `;
      },
      {
        maxWait: 5000, // Max time to wait for a connection from pool
        timeout: 10000, // Max time for the transaction to complete
      }
    );


    return {
      suggestions: suggestions.map((s) => ({
        label: s.label,
        type: s.type,
        itemId: s.itemId,
        score: s.score,
      })),
    };
  }
}
