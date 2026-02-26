import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  quantityOnHand?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  reorderLevel?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string;
}
