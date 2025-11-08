import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(500) // minimum 5.00 in minor currency units
  priceCents!: number;

  @IsInt()
  @Min(15)
  durationMinutes!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  depositPercent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
