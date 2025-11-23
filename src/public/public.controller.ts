import { Controller, Get, Param, Query } from '@nestjs/common';
import { HighlightVendorsQueryDto } from './dto/highlight-vendors.dto';
import { DiscoverServicesQueryDto } from './dto/discover-services.dto';
import { SearchVendorsQueryDto } from './dto/search-vendors.dto';
import { PublicCatalogService, ServiceSummary, VendorSummary, NearbyServiceSummary, ServiceDetailSummary, VendorDetailSummary } from './public.service';
import { NearbyServicesQueryDto } from './dto/nearby-services.dto';

@Controller('public/catalog')
export class PublicCatalogController {
  constructor(private readonly catalog: PublicCatalogService) {}

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

  @Get('services/:serviceId')
  serviceById(
    @Param('serviceId') serviceId: string,
  ): Promise<ServiceDetailSummary> {
    return this.catalog.getServiceById(serviceId);
  }
}
