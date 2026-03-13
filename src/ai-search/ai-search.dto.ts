import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, Min, Max, IsArray, ValidateNested, IsNumber, IsBoolean } from 'class-validator';

export class TimeRangeDto {
  @ApiProperty({ example: 480 })
  @IsInt()
  start: number;

  @ApiProperty({ example: 720 })
  @IsInt()
  end: number;
}

export class ParsedQueryDto {
  @ApiProperty({ example: 'knotless braids' })
  @IsString()
  serviceIntent: string;

  @ApiPropertyOptional({ example: 'East Legon', nullable: true })
  @IsOptional()
  @IsString()
  location: string | null;

  @ApiPropertyOptional({ example: 'tomorrow morning', nullable: true })
  @IsOptional()
  @IsString()
  dateTime: string | null;

  @ApiPropertyOptional({ example: '2026-03-14', nullable: true })
  @IsOptional()
  @IsString()
  resolvedDate: string | null;

  @ApiPropertyOptional({ type: () => TimeRangeDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TimeRangeDto)
  timeRange: TimeRangeDto | null;
}

export class AiSearchRequestDto {
  @ApiProperty({
    example: 'I need a hairstylist for knotless braids tomorrow morning around East Legon.',
  })
  @IsString()
  query: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10, example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({ minimum: 0, default: 0, example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;

  @ApiPropertyOptional({
    description: 'Opaque token returned from a previous AI search to reuse parsed query context.',
    example: 'eyJzZXJ2aWNlSW50ZW50Ijoia25vdGxlc3MgYnJhaWRzIn0=',
  })
  @IsOptional()
  @IsString()
  parsedQueryToken?: string;
}

export type ParsedQuery = ParsedQueryDto;

export class AiSearchResultDto {
  @ApiProperty({ description: 'Service ID' })
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  vendorId: string;

  @ApiProperty()
  @IsString()
  vendorName: string;

  @ApiProperty()
  @IsString()
  vendorHandle: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  vendorAvatar: string | null;

  @ApiProperty()
  @IsString()
  serviceName: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description: string | null;

  @ApiProperty({ example: 35000 })
  @IsInt()
  priceCents: number;

  @ApiProperty({ example: 90 })
  @IsInt()
  durationMinutes: number;

  @ApiPropertyOptional({ nullable: true, example: 4.2 })
  @IsOptional()
  @IsNumber()
  distanceKm: number | null;

  @ApiProperty({ example: 4.8 })
  @IsNumber()
  rating: number;

  @ApiProperty({ example: 122 })
  @IsInt()
  reviewCount: number;

  @ApiProperty({ example: 38, description: 'Similarity score as a percentage from 0 to 100.' })
  @IsInt()
  similarityScore: number;

  @ApiProperty({ type: [String], example: ['9:00 AM', '9:30 AM', '10:00 AM'] })
  @IsArray()
  @IsString({ each: true })
  availableSlots: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  categoryName: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  vendorLocation: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  vendorTitle: string | null;

  @ApiPropertyOptional({ nullable: true, example: 6 })
  @IsOptional()
  @IsInt()
  yearsExperience: number | null;

  @ApiProperty({ example: 240 })
  @IsInt()
  bookingCount: number;

  @ApiPropertyOptional({ nullable: true, example: 20 })
  @IsOptional()
  @IsInt()
  depositPercent: number | null;

  @ApiProperty({ type: [String], example: ['Hot wash', 'Hair trim'] })
  @IsArray()
  @IsString({ each: true })
  includes: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  serviceImage: string | null;
}

export class AiSearchResponseDto {
  @ApiProperty({ type: () => ParsedQueryDto })
  @ValidateNested()
  @Type(() => ParsedQueryDto)
  parsedQuery: ParsedQueryDto;

  @ApiProperty({
    description: 'Opaque token the client can send back on subsequent paginated requests.',
    example: 'eyJzZXJ2aWNlSW50ZW50Ijoia25vdGxlc3MgYnJhaWRzIiwibG9jYXRpb24iOiJFYXN0IExlZ29uIn0=',
  })
  @IsString()
  parsedQueryToken: string;

  @ApiProperty({ type: () => [AiSearchResultDto] })
  @ValidateNested({ each: true })
  @Type(() => AiSearchResultDto)
  results: AiSearchResultDto[];

  @ApiProperty({ example: 24 })
  @IsInt()
  totalEstimate: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  hasMore: boolean;
}

export type AiSearchResult = AiSearchResultDto;
export type AiSearchResponse = AiSearchResponseDto;
