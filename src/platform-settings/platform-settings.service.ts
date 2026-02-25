import { BadRequestException, Injectable } from '@nestjs/common';
import { PlatformSettingKey } from '@prisma/client';
import { PrismaService } from '../prisma';

const DEFAULT_PLATFORM_FEE_PERCENT = 10;

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformFeePercent(): Promise<number> {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key: PlatformSettingKey.PLATFORM_FEE_PERCENT },
    });

    if (
      !setting ||
      setting.intValue === null ||
      setting.intValue === undefined
    ) {
      return DEFAULT_PLATFORM_FEE_PERCENT;
    }

    return setting.intValue;
  }

  async upsertPlatformFeePercent(percent: number, userId: string) {
    const clamped = Math.max(0, Math.min(percent, 100));

    return this.prisma.platformSetting.upsert({
      where: { key: PlatformSettingKey.PLATFORM_FEE_PERCENT },
      update: {
        intValue: clamped,
        updatedById: userId,
        updatedAt: new Date(),
      },
      create: {
        key: PlatformSettingKey.PLATFORM_FEE_PERCENT,
        intValue: clamped,
        updatedById: userId,
      },
    });
  }
}
