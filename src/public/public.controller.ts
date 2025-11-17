import { Controller, Get, Query } from '@nestjs/common';
import { HighlightVendorsQueryDto } from './dto/highlight-vendors.dto';
import { DiscoverServicesQueryDto } from './dto/discover-services.dto';
import { PublicCatalogService, ServiceSummary, VendorSummary, NearbyServiceSummary } from './public.service';
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
}
