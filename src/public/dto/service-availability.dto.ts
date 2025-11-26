import { IsOptional, IsString } from 'class-validator';

export class ServiceAvailabilityQueryDto {
  @IsOptional()
  @IsString()
  date?: string;
}
