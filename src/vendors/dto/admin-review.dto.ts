import { IsOptional, IsString, MinLength } from 'class-validator';

export class AdminReviewDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  note?: string;
}

export class AdminRejectDto {
  @IsString()
  @MinLength(3)
  reason: string;
}
