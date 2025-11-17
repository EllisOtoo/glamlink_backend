import { Controller, Get, Query } from '@nestjs/common';
import { HighlightVendorsQueryDto } from './dto/highlight-vendors.dto';
import { DiscoverServicesQueryDto } from './dto/discover-services.dto';
import { PublicCatalogService, ServiceSummary, VendorSummary } from './public.service';

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
}
