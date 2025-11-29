import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdateServiceMarkupDto } from './dto/update-service-markup.dto';

@Controller('admin/settings')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('service-markup')
  async getServiceMarkup() {
    const basisPoints = await this.settings.getServiceMarkupBps();
    return {
      basisPoints,
      percent: basisPoints / 100,
    };
  }

  @Put('service-markup')
  async updateServiceMarkup(
    @CurrentUser() user: User,
    @Body() dto: UpdateServiceMarkupDto,
  ) {
    const setting = await this.settings.upsertServiceMarkupBps(
      dto.basisPoints,
      user.id,
    );
    return {
      basisPoints: setting.intValue ?? 0,
      percent: (setting.intValue ?? 0) / 100,
      updatedAt: setting.updatedAt,
      updatedById: setting.updatedById,
    };
  }
}
