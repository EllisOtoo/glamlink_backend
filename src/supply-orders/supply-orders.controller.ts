import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestWithAuth } from '../auth/decorators/current-user.decorator';
import { CreateSupplyOrderDto } from './dto/create-supply-order.dto';
import { SupplyOrdersService } from './supply-orders.service';
import { ListSupplyOrdersDto } from './dto/list-supply-orders.dto';

@Controller('vendors/me/supplies/orders')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
export class SupplyOrdersController {
  constructor(private readonly service: SupplyOrdersService) {}

  @Post('checkout')
  checkout(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Body() dto: CreateSupplyOrderDto,
  ) {
    return this.service.checkout(user.id, dto);
  }

  @Get()
  listOrders(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Query() query: ListSupplyOrdersDto,
  ) {
    return this.service.listForVendor(user.id, query);
  }
}
