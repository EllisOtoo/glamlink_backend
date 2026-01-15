import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdatePortfolioItemDto {
  @IsString()
  @IsOptional()
  caption?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serviceIds?: string[];
}
