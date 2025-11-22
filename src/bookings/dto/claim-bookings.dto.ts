import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ClaimBookingsDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
