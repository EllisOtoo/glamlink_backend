import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestWithAuth } from '../auth/decorators/current-user.decorator';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { SetWeeklyAvailabilityDto } from './dto/set-weekly-availability.dto';
import { CreateAvailabilityOverrideDto } from './dto/create-override.dto';
import { AvailabilitySlotsQueryDto } from './dto/availability-slots.dto';

@Controller('vendors/me/services')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
export class VendorServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  listServices(@CurrentUser() user: RequestWithAuth['auth']['user']) {
    return this.servicesService.listServicesForVendor(user.id);
  }

  @Post()
  createService(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Body() dto: CreateServiceDto,
  ) {
    return this.servicesService.createServiceForVendor(user.id, dto);
  }

  @Put(':serviceId')
  updateService(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Param('serviceId') serviceId: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.updateServiceForVendor(user.id, serviceId, dto);
  }

  @Post(':serviceId/archive')
  archiveService(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Param('serviceId') serviceId: string,
  ) {
    return this.servicesService.setServiceActiveState(
      user.id,
      serviceId,
      false,
    );
  }

  @Post(':serviceId/restore')
  restoreService(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Param('serviceId') serviceId: string,
  ) {
    return this.servicesService.setServiceActiveState(user.id, serviceId, true);
  }
}

@Controller('vendors/me/availability')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
export class VendorAvailabilityController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('weekly')
  getWeeklyAvailability(@CurrentUser() user: RequestWithAuth['auth']['user']) {
    return this.servicesService.getWeeklyAvailability(user.id);
  }

  @Put('weekly')
  setWeeklyAvailability(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Body() dto: SetWeeklyAvailabilityDto,
  ) {
    return this.servicesService.setWeeklyAvailability(user.id, dto);
  }

  @Get('overrides')
  listOverrides(@CurrentUser() user: RequestWithAuth['auth']['user']) {
    return this.servicesService.listOverrides(user.id);
  }

  @Post('overrides')
  createOverride(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Body() dto: CreateAvailabilityOverrideDto,
  ) {
    return this.servicesService.createOverride(user.id, dto);
  }

  @Delete('overrides/:overrideId')
  deleteOverride(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Param('overrideId') overrideId: string,
  ) {
    return this.servicesService.deleteOverride(user.id, overrideId);
  }

  @Get('slots')
  listAvailabilitySlots(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Query() query: AvailabilitySlotsQueryDto,
  ) {
    return this.servicesService.listAvailabilitySlots(user.id, query);
  }
}
