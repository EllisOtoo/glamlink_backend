import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_SERVICE_IMAGE_SIZE_BYTES } from '../services.constants';

export class RequestServiceImageUploadDto {
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SERVICE_IMAGE_SIZE_BYTES)
  sizeBytes: number;
}
