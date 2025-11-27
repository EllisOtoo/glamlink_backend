import { IsOptional, IsString } from 'class-validator';

export class CatalogQueryDto {
  @IsOptional()
  @IsString()
  category?: string;
}
