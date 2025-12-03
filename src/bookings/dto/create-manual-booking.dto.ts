import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateManualBookingDto {
  @IsNotEmpty()
  @IsString()
  serviceId!: string;

  @IsNotEmpty()
  @IsString()
  startAt!: string;

  @IsNotEmpty()
  @IsString()
  customerName!: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  seatId?: string;

  @IsOptional()
  @IsBoolean()
  collectDeposit?: boolean;

  @IsOptional()
  @IsString()
  giftCardCode?: string;
}
