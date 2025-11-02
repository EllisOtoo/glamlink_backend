import { UserRole } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { trimStringTransform } from './transformers';

export class FirebaseLoginDto {
  @Transform(trimStringTransform)
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
