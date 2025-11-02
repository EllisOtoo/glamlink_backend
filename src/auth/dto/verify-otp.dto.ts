import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { trimStringTransform } from './transformers';

export class VerifyOtpDto {
  @Transform(trimStringTransform)
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(trimStringTransform)
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
