import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class RequestProfilePhotoUploadDto {
  @IsNotEmpty()
  @IsString()
  mimeType!: string;

  @IsInt()
  @IsPositive()
  sizeBytes!: number;
}
