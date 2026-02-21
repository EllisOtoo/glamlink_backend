import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AiSearchRequestDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  parsedQueryToken?: string;
}

export interface ParsedQuery {
  serviceIntent: string;
  location: string | null;
  dateTime: string | null;
  resolvedDate: string | null;
  timeRange: { start: number; end: number } | null;
}

export interface AiSearchResult {
  id: string; // Service ID
  vendorId: string;
  vendorName: string;
  vendorHandle: string;
  vendorAvatar: string | null;
  serviceName: string;
  priceCents: number;
  durationMinutes: number;
  distanceKm: number | null;
  rating: number;
  reviewCount: number;
  similarityScore: number;
  availableSlots: string[]; // e.g., ["09:00", "10:30"]
}

export interface AiSearchResponse {
  parsedQuery: ParsedQuery;
  parsedQueryToken: string;
  results: AiSearchResult[];
  totalEstimate: number;
  hasMore: boolean;
}
