import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePublicBookingDto {
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
}
