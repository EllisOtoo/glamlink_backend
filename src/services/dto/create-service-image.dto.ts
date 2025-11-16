import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceImageDto {
  @IsString()
  @MinLength(6)
  storageKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  caption?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
