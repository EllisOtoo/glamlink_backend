import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PayoutMethodType } from '@prisma/client';

export class CreatePayoutMethodDto {
  @IsEnum(PayoutMethodType)
  @IsNotEmpty()
  type: PayoutMethodType;

  @IsString()
  @IsNotEmpty()
  accountName: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  // Bank Details
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  branchCode?: string;

  // Mobile Money Details
  @IsString()
  @IsOptional()
  mobileNetwork?: string;

  @IsString()
  @IsOptional()
  mobileNumber?: string;
}
