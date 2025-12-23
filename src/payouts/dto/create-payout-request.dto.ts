import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreatePayoutRequestDto {
  @IsInt()
  @Min(5000) // GHS 50.00 in Pesewas
  @IsNotEmpty()
  amountPesewas: number;

  @IsString()
  @IsNotEmpty()
  payoutMethodId: string;
}
