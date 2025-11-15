import { PushPlatform } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsEnum(PushPlatform)
  platform?: PushPlatform;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}
