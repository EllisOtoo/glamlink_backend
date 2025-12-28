import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class RequestPortfolioUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsNumber()
  sizeBytes: number;
}
