import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AvailabilityWindowDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsInt()
  @Min(0)
  @Max(24 * 60 - 1)
  startMinute!: number;

  @IsInt()
  @Min(1)
  @Max(24 * 60)
  endMinute!: number;
}

export class SetWeeklyAvailabilityDto {
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(70)
  @ValidateNested({ each: true })
  @Type(() => AvailabilityWindowDto)
  windows!: AvailabilityWindowDto[];
}

export { AvailabilityWindowDto };
