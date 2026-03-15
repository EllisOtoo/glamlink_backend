import { IsIn, IsOptional } from 'class-validator';

export class RunRemindersDto {
  @IsOptional()
  @IsIn(['24h', '2h', 'all'])
  stage?: '24h' | '2h' | 'all';
}
