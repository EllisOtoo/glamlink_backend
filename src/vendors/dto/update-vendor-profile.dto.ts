import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const HANDLE_REGEX = /^[a-z0-9](?:[a-z0-9-_]{1,28}[a-z0-9])?$/;

export class UpdateVendorProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  businessName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  handle?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @Length(5, 32)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  locationArea?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  instagramHandle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tiktokHandle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  facebookUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  xHandle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  youtubeChannel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  professionalTitle?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  yearsExperience?: number;

  @IsOptional()
  @ValidateIf((o) => o.websiteUrl !== '')
  @IsUrl({ require_tld: false, require_protocol: false }, { message: 'websiteUrl must be a valid URL address' })
  websiteUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  serviceRadiusKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  onboardingStep?: number;

  @IsOptional()
  @IsBoolean()
  travelsNationally?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000) // Max GHS 10/km (1000 pesewas = GHS 10)
  travelFeePerKmPesewas?: number;
}
