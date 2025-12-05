import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_REVIEW_MEDIA_SIZE_BYTES } from '../reviews.constants';

export class RequestReviewMediaUploadDto {
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_REVIEW_MEDIA_SIZE_BYTES)
  sizeBytes: number;
}
