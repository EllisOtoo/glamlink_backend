import { UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { trimStringTransform } from './transformers';

export class FirebaseRegisterDto {
  @Transform(trimStringTransform)
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
