import {
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGiftCardDto {
  @IsNotEmpty()
  @IsString()
  vendorId!: string;

  @IsInt()
  @Min(1000)
  amountPesewas!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  purchaserName!: string;

  @IsNotEmpty()
  @IsEmail()
  purchaserEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  purchaserPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  recipientName?: string;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  message?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
