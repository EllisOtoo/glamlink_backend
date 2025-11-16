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
import type { ServiceImage } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestWithAuth } from '../auth/decorators/current-user.decorator';
import { VerifiedVendorGuard } from '../vendors/guards/verified-vendor.guard';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { SetWeeklyAvailabilityDto } from './dto/set-weekly-availability.dto';
import { CreateAvailabilityOverrideDto } from './dto/create-override.dto';
import { AvailabilitySlotsQueryDto } from './dto/availability-slots.dto';
import { RequestServiceImageUploadDto } from './dto/request-service-image-upload.dto';
import { CreateServiceImageDto } from './dto/create-service-image.dto';
import { ReorderServiceImagesDto } from './dto/reorder-service-images.dto';
import { StorageService } from '../storage/storage.service';

@Controller('vendors/me/services')
@UseGuards(SessionAuthGuard, RolesGuard, VerifiedVendorGuard)
@Roles(UserRole.VENDOR)
export class VendorServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async listServices(@CurrentUser() user: RequestWithAuth['auth']['user']) {
    const services = await this.servicesService.listServicesForVendor(user.id);
    return services.map((service) => this.withImageUrls(service));
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

  @Post(':serviceId/images/upload-url')
  requestServiceImageUploadUrl(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Param('serviceId') serviceId: string,
    @Body() dto: RequestServiceImageUploadDto,
  ) {
    return this.servicesService.requestServiceImageUploadUrl(
      user.id,
      serviceId,
      dto,
    );
  }

  @Post(':serviceId/images')
  async addServiceImage(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateServiceImageDto,
  ) {
    const image = await this.servicesService.createServiceImageForVendor(
      user.id,
      serviceId,
      dto,
    );
    return this.withImageUrl(image);
  }

  @Get(':serviceId/images')
  async listServiceImages(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Param('serviceId') serviceId: string,
  ) {
    const images = await this.servicesService.listServiceImagesForVendor(
      user.id,
      serviceId,
    );
    return images.map((image) => this.withImageUrl(image));
  }

  @Delete(':serviceId/images/:imageId')
  async deleteServiceImage(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Param('serviceId') serviceId: string,
    @Param('imageId') imageId: string,
  ) {
    await this.servicesService.deleteServiceImage(user.id, serviceId, imageId);
    return { success: true };
  }

  @Post(':serviceId/images/reorder')
  async reorderServiceImages(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Param('serviceId') serviceId: string,
    @Body() dto: ReorderServiceImagesDto,
  ) {
    const images = await this.servicesService.reorderServiceImages(
      user.id,
      serviceId,
      dto,
    );
    return images.map((image) => this.withImageUrl(image));
  }

  private withImageUrls<T extends { images?: ServiceImage[] }>(
    service: T,
  ): T & { images: Array<ServiceImage & { imageUrl: string }> } {
    const images = Array.isArray(service.images)
      ? service.images.map((image) => this.withImageUrl(image))
      : [];
    return {
      ...service,
      images,
    };
  }

  private withImageUrl(
    image: ServiceImage,
  ): ServiceImage & { imageUrl: string } {
    const updatedAt =
      image.updatedAt instanceof Date
        ? image.updatedAt
        : new Date(image.updatedAt);
    const version = Number.isNaN(updatedAt.getTime())
      ? undefined
      : Math.floor(updatedAt.getTime() / 1000);
    return {
      ...image,
      imageUrl: this.storage.buildPublicUrl(image.storageKey, version),
    };
  }
}

@Controller('vendors/me/availability')
@UseGuards(SessionAuthGuard, RolesGuard, VerifiedVendorGuard)
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
