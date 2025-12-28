import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ConfirmPortfolioUploadDto {
  @IsString()
  @IsNotEmpty()
  storageKey: string;

  @IsString()
  @IsOptional()
  caption?: string;
}
