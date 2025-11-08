import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaystackService } from './paystack.service';
import type { PaystackWebhookEvent } from './paystack.service';

type RawBodyRequest<T> = T & { rawBody?: Buffer };

@Controller('webhooks/paystack')
export class PaystackWebhookController {
  constructor(private readonly paystackService: PaystackService) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature?: string,
  ) {
    if (!this.paystackService.verifySignature(signature, request.rawBody)) {
      throw new UnauthorizedException('Invalid Paystack signature.');
    }

    const payload = request.body as PaystackWebhookEvent;
    await this.paystackService.handleWebhook(payload);
    return { received: true };
  }
}
