import { Prisma } from '@prisma/client';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  leadTimeDays?: number;

  @IsOptional()
  @IsUrl()
  mediaUrl?: string;

  @IsOptional()
  attributes?: Prisma.InputJsonValue;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  supplierCostCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  markupPercent?: number;
}
