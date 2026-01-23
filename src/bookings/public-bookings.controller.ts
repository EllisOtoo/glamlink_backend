import {
  Body,
  Controller,
  Get,
  Param,
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
import { CancelBookingDto } from './dto/cancel-booking.dto';

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

  @Get(':bookingId')
  async getSummary(@Param('bookingId') bookingId: string) {
    return this.bookingsService.getPublicBookingSummary(bookingId);
  }

  @Post(':bookingId/cancel')
  async cancelPending(
    @Param('bookingId') bookingId: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancelPendingBookingWithoutAuth(bookingId, dto);
  }

  private async resolveAuthenticatedUser(
    request: Request,
  ): Promise<User | null> {
    const header = request.headers.authorization;
    let token: string | undefined;

    if (header?.startsWith('Bearer ')) {
      token = header.substring(7);
    } else {
      // Fall back to cookie for web clients
      token = (request as any).cookies?.['access_token'];
    }

    if (!token) {
      return null;
    }

    // Prefer JWT so newer clients can authenticate without legacy sessions.
    const jwtResult = await this.authService.validateJwtToken(token);
    if (jwtResult) {
      return jwtResult.user;
    }

    try {
      const { user } = await this.authService.validateSessionToken(token);
      return user;
    } catch (error) {
      return null;
    }
  }
}
