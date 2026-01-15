import { IsInt, IsString, Max } from 'class-validator';
import { MAX_STAFF_AVATAR_SIZE_BYTES } from '../vendors.constants';

export class RequestStaffAvatarUploadUrlDto {
  @IsString()
  mimeType!: string;

  @IsInt()
  @Max(MAX_STAFF_AVATAR_SIZE_BYTES)
  sizeBytes!: number;
}
