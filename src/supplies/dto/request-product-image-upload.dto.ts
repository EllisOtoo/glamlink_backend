import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class RequestProductImageUploadDto {
  @IsNotEmpty()
  @IsString()
  mimeType!: string;

  @IsInt()
  sizeBytes!: number;
}
