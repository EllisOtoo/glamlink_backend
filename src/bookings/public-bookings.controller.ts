import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { BookingsService } from './bookings.service';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';
import { PaystackService } from '../payments/paystack.service';
import { AuthService } from '../auth/auth.service';
import type { User } from '@prisma/client';

@Controller('public/bookings')
export class PublicBookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly paystackService: PaystackService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  async create(@Body() dto: CreatePublicBookingDto, @Req() request: Request) {
    const user = await this.resolveAuthenticatedUser(request);
    const booking = await this.bookingsService.createPublicBooking(
      dto,
      user?.id,
    );
    const paystack = this.paystackService.buildCheckoutPayload({ booking });
    return {
      booking,
      paystack,
    };
  }

  private async resolveAuthenticatedUser(
    request: Request,
  ): Promise<User | null> {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }

    if (!header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid Authorization header.');
    }

    const token = header.substring(7);
    const { user } = await this.authService.validateSessionToken(token);
    return user;
  }
}
