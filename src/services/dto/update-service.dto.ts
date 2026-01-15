import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  priceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(15)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includes?: string[];
}
