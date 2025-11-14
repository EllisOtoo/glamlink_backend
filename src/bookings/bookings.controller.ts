import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { ClaimBookingsDto } from './dto/claim-bookings.dto';

@Controller()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendors/me/bookings/upcoming')
  async listVendorUpcomingBookings(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number.parseInt(limit ?? '', 10);
    const take = Number.isFinite(parsedLimit) ? parsedLimit : 10;
    return this.bookingsService.listVendorUpcomingBookings(user.id, take);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.VENDOR)
  @Get('customers/me/bookings/upcoming')
  async listCustomerUpcomingBookings(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number.parseInt(limit ?? '', 10);
    const take = Number.isFinite(parsedLimit) ? parsedLimit : 10;
    return this.bookingsService.listCustomerUpcomingBookings(user.id, take);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.VENDOR)
  @Post('customers/me/bookings/claim')
  async claimCustomerBookings(
    @CurrentUser() user: User,
    @Body() dto: ClaimBookingsDto,
  ) {
    return this.bookingsService.claimBookingsForCustomer(user, dto);
  }
}
