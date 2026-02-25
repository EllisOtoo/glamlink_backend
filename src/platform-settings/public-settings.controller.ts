import { Controller, Get } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';

@Controller('public/settings')
export class PublicSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('platform-fee')
  async getPlatformFee() {
    const percent = await this.settings.getPlatformFeePercent();
    return {
      percent,
    };
  }

  @Get('service-markup')
  async getServiceMarkup() {
    const basisPoints = await this.settings.getServiceMarkupBps();
    return {
      basisPoints,
      percent: basisPoints / 100,
    };
  }
}
