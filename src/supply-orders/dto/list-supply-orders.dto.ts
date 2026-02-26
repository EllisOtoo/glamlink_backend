import { IsEnum, IsOptional } from 'class-validator';
import { SupplyOrderStatus } from '@prisma/client';

export class ListSupplyOrdersDto {
  @IsOptional()
  @IsEnum(SupplyOrderStatus)
  status?: SupplyOrderStatus;
}
