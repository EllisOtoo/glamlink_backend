import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdatePlatformFeeDto } from './dto/update-platform-fee.dto';

@Controller('admin/settings')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('platform-fee')
  async getPlatformFee() {
    const percent = await this.settings.getPlatformFeePercent();
    return {
      percent,
    };
  }

  @Put('platform-fee')
  async updatePlatformFee(
    @CurrentUser() user: User,
    @Body() dto: UpdatePlatformFeeDto,
  ) {
    const setting = await this.settings.upsertPlatformFeePercent(
      dto.percent,
      user.id,
    );
    return {
      percent: setting.intValue ?? 0,
      updatedAt: setting.updatedAt,
      updatedById: setting.updatedById,
    };
  }
}
