import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { VerifiedVendorGuard } from '../vendors/guards/verified-vendor.guard';
import { BookingsService } from './bookings.service';
import { VendorBookingsQueryDto } from './dto/vendor-bookings-query.dto';

@Controller()
@UseGuards(SessionAuthGuard, RolesGuard, VerifiedVendorGuard)
@Roles(UserRole.VENDOR)
export class VendorBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('vendors/me/bookings')
  listBookings(
    @CurrentUser() user: User,
    @Query() query: VendorBookingsQueryDto,
  ) {
    return this.bookingsService.listVendorBookings(user.id, query);
  }

  @Get('vendors/me/bookings/:bookingId')
  getBooking(@CurrentUser() user: User, @Param('bookingId') bookingId: string) {
    return this.bookingsService.getVendorBooking(user.id, bookingId);
  }
}
