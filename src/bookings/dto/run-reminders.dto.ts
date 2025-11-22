import { IsOptional, IsPositive } from 'class-validator';

export class RunRemindersDto {
  @IsOptional()
  @IsPositive()
  hoursAhead?: number;
}
