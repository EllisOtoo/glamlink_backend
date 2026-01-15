import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, IsArray } from 'class-validator';
import { PortfolioItemType } from '@prisma/client';

export class ConfirmPortfolioUploadDto {
  @IsString()
  @IsOptional()
  storageKey?: string;

  @IsEnum(PortfolioItemType)
  @IsOptional()
  type?: PortfolioItemType;

  @IsUrl()
  @IsOptional()
  externalUrl?: string;

  @IsString()
  @IsOptional()
  caption?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serviceIds?: string[];
}
