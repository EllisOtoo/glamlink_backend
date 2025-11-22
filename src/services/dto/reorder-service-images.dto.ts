import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderServiceImagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  imageIds: string[];
}
