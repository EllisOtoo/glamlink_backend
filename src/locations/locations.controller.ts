import { Controller, Get, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('regions')
  async getRegions() {
    return this.locationsService.getRegions();
  }

  @Get('cities')
  async getCities(@Query('regionId') regionId?: string) {
    return this.locationsService.getCities(regionId);
  }
}
