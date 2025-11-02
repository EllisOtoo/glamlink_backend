import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateKycDocumentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  type: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  fileName: string;

  @IsString()
  @MinLength(6)
  storageKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}
