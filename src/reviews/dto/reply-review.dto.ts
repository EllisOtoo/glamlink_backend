import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReplyReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reply?: string;
}
