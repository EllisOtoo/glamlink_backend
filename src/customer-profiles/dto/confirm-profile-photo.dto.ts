import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmProfilePhotoDto {
  @IsNotEmpty()
  @IsString()
  storageKey!: string;
}
