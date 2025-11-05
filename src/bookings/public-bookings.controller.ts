import { Body, Controller, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';
import { PaystackService } from '../payments/paystack.service';

@Controller('public/bookings')
export class PublicBookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly paystackService: PaystackService,
  ) {}

  @Post()
  async create(@Body() dto: CreatePublicBookingDto) {
    const booking = await this.bookingsService.createPublicBooking(dto);
    const paystack = this.paystackService.buildCheckoutPayload({ booking });
    return {
      booking,
      paystack,
    };
  }
}
