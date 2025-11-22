import { IsString, MinLength } from 'class-validator';

export class ConfirmLogoDto {
  @IsString()
  @MinLength(6)
  storageKey: string;
}
