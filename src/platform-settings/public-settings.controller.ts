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
  }}
