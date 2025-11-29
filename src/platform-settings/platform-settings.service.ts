import { BadRequestException, Injectable } from '@nestjs/common';
import { PlatformSettingKey } from '@prisma/client';
import { PrismaService } from '../prisma';

const DEFAULT_SERVICE_MARKUP_BPS = 0;

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getServiceMarkupBps(): Promise<number> {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key: PlatformSettingKey.SERVICE_MARKUP_BPS },
    });

    if (!setting || setting.intValue === null || setting.intValue === undefined) {
      return DEFAULT_SERVICE_MARKUP_BPS;
    }

    return setting.intValue;
  }

  async upsertServiceMarkupBps(basisPoints: number, userId: string) {
    const clamped = Math.max(0, Math.min(basisPoints, 5000));

    return this.prisma.platformSetting.upsert({
      where: { key: PlatformSettingKey.SERVICE_MARKUP_BPS },
      update: {
        intValue: clamped,
        updatedById: userId,
        updatedAt: new Date(),
      },
      create: {
        key: PlatformSettingKey.SERVICE_MARKUP_BPS,
        intValue: clamped,
        updatedById: userId,
      },
    });
  }

  applyServiceMarkup(amount: number, basisPoints: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid amount for markup calculation.');
    }
    const multiplier = 1 + basisPoints / 10000;
    return Math.max(1, Math.round(amount * multiplier));
  }
}
