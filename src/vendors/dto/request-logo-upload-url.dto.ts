import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_VENDOR_LOGO_SIZE_BYTES } from '../vendors.constants';

export class RequestLogoUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_VENDOR_LOGO_SIZE_BYTES)
  sizeBytes: number;
}
