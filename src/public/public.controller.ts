import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { HighlightVendorsQueryDto } from './dto/highlight-vendors.dto';
import { DiscoverServicesQueryDto } from './dto/discover-services.dto';
import { SearchVendorsQueryDto } from './dto/search-vendors.dto';
import {
  PublicCatalogService,
  ServiceSummary,
  VendorSummary,
  NearbyServiceSummary,
  ServiceDetailSummary,
  VendorDetailSummary,
  ServiceAvailabilitySlot,
  ServiceReviewsResponse,
} from './public.service';
import { NearbyServicesQueryDto } from './dto/nearby-services.dto';
import { ServiceAvailabilityQueryDto } from './dto/service-availability.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestWithAuth } from '../auth/decorators/current-user.decorator';
import { ServiceReviewsQueryDto } from './dto/service-reviews.dto';

@Controller('public/catalog')
export class PublicCatalogController {
  constructor(private readonly catalog: PublicCatalogService) {}

  @Get('categories')
  listCategories() {
    return this.catalog.listCategories();
  }

  @Get('vendors/highlights')
  highlightVendors(
    @Query() query: HighlightVendorsQueryDto,
  ): Promise<VendorSummary[]> {
    return this.catalog.highlightVendors(query.limit);
  }

  @Get('vendors/search')
  searchVendors(
    @Query() query: SearchVendorsQueryDto,
  ): Promise<VendorSummary[]> {
    return this.catalog.searchVendorsByHandle(query.handle, query.limit);
  }

  @Get('vendors/:handle')
  vendorByHandle(
    @Param('handle') handle: string,
  ): Promise<VendorDetailSummary> {
    return this.catalog.getVendorByHandle(handle);
  }

  @Get('vendors/:handle/portfolio')
  vendorPortfolioByHandle(
    @Param('handle') handle: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.catalog.getVendorPortfolio(handle, parsedLimit);
  }

  @Get('services/discover')
  discoverServices(
    @Query() query: DiscoverServicesQueryDto,
  ): Promise<ServiceSummary[]> {
    return this.catalog.discoverServices(query);
  }

  @Get('services/nearby')
  nearbyServices(
    @Query() query: NearbyServicesQueryDto,
  ): Promise<NearbyServiceSummary[]> {
    return this.catalog.discoverNearbyServices(query);
  }

  @Get('services/me')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  listMyServices(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
  ): Promise<ServiceSummary[]> {
    return this.catalog.listServicesForVendor(user.id);
  }

  @Get('services/:serviceId')
  serviceById(
    @Param('serviceId') serviceId: string,
  ): Promise<ServiceDetailSummary> {
    return this.catalog.getServiceById(serviceId);
  }

  @Get('services/:serviceId/availability')
  availabilityByService(
    @Param('serviceId') serviceId: string,
    @Query() query: ServiceAvailabilityQueryDto,
  ): Promise<ServiceAvailabilitySlot[]> {
    return this.catalog.getServiceAvailability(serviceId, query.date);
  }

  @Get('services/:serviceId/reviews')
  serviceReviews(
    @Param('serviceId') serviceId: string,
    @Query() query: ServiceReviewsQueryDto,
  ): Promise<ServiceReviewsResponse> {
    return this.catalog.getServiceReviews(serviceId, query);
  }
}
