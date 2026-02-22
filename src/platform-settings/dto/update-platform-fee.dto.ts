import { IsInt, Max, Min } from 'class-validator';

export class UpdatePlatformFeeDto {
  @IsInt()
  @Min(0)
  @Max(100)
  percent!: number;
}
