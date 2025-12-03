import { IsEmail, IsNotEmpty } from 'class-validator';

export class LookupGiftCardQueryDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;
}
