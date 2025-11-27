import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phoneNumber?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceAreas?: string[];

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
