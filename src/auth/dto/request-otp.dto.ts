import { IsEmail, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { trimStringTransform } from './transformers';

export class RequestOtpDto {
  @Transform(trimStringTransform)
  @IsEmail()
  @IsString()
  @MaxLength(254)
  email!: string;
}
