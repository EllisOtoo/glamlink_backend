import { IsInt, Max, Min } from 'class-validator';

export class UpdateServiceMarkupDto {
  @IsInt()
  @Min(0)
  @Max(5000)
  basisPoints!: number;
}
