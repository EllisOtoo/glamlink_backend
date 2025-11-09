import {
  AvailabilityOverrideType,
  Service,
  AvailabilityOverride,
  WeeklyAvailability,
} from '@prisma/client';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import {
  AvailabilityWindowDto,
  SetWeeklyAvailabilityDto,
} from './dto/set-weekly-availability.dto';
import { CreateAvailabilityOverrideDto } from './dto/create-override.dto';
import { AvailabilitySlotsQueryDto } from './dto/availability-slots.dto';

interface VendorContext {
  id: string;
}

interface TimeWindow {
  start: Date;
  end: Date;
}

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async listServicesForVendor(userId: string): Promise<Service[]> {
    const vendor = await this.requireVendor(userId);
    return this.prisma.service.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createServiceForVendor(
    userId: string,
    dto: CreateServiceDto,
  ): Promise<Service> {
    const vendor = await this.requireVendor(userId);
    this.assertDuration(dto.durationMinutes);
    const bufferMinutes =
      typeof dto.bufferMinutes === 'number' ? dto.bufferMinutes : 0;
    this.assertBuffer(bufferMinutes);
    const description =
      typeof dto.description === 'string' && dto.description.trim().length > 0
        ? dto.description.trim()
        : null;
    const isActive = typeof dto.isActive === 'boolean' ? dto.isActive : true;

    return this.prisma.service.create({
      data: {
        vendorId: vendor.id,
        name: dto.name.trim(),
        description,
        priceCents: dto.priceCents,
        durationMinutes: dto.durationMinutes,
        bufferMinutes,
        isActive,
      },
    });
  }

  async updateServiceForVendor(
    userId: string,
    serviceId: string,
    dto: UpdateServiceDto,
  ): Promise<Service> {
    const vendor = await this.requireVendor(userId);
    const existing = await this.prisma.service.findFirst({
      where: { id: serviceId, vendorId: vendor.id },
    });
    if (!existing) {
      throw new NotFoundException('Service not found.');
    }

    const data: {
      name?: string;
      description?: string | null;
      priceCents?: number;
      durationMinutes?: number;
      bufferMinutes?: number;
      isActive?: boolean;
    } = {};

    if (typeof dto.name === 'string') {
      data.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      const descriptionValue =
        typeof dto.description === 'string' && dto.description.trim().length > 0
          ? dto.description.trim()
          : null;
      data.description = descriptionValue;
    }

    if (typeof dto.priceCents === 'number') {
      data.priceCents = dto.priceCents;
    }

    if (typeof dto.durationMinutes === 'number') {
      this.assertDuration(dto.durationMinutes);
      data.durationMinutes = dto.durationMinutes;
    }

    if (typeof dto.bufferMinutes === 'number') {
      this.assertBuffer(dto.bufferMinutes);
      data.bufferMinutes = dto.bufferMinutes;
    }

    if (typeof dto.isActive === 'boolean') {
      data.isActive = dto.isActive;
    }

    return this.prisma.service.update({
      where: { id: serviceId },
      data,
    });
  }

  async setServiceActiveState(
    userId: string,
    serviceId: string,
    isActive: boolean,
  ): Promise<Service> {
    const vendor = await this.requireVendor(userId);
    const existing = await this.prisma.service.findFirst({
      where: { id: serviceId, vendorId: vendor.id },
    });
    if (!existing) {
      throw new NotFoundException('Service not found.');
    }

    return this.prisma.service.update({
      where: { id: serviceId },
      data: { isActive },
    });
  }

  async getWeeklyAvailability(userId: string): Promise<WeeklyAvailability[]> {
    const vendor = await this.requireVendor(userId);
    return this.prisma.weeklyAvailability.findMany({
      where: { vendorId: vendor.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });
  }

  async setWeeklyAvailability(
    userId: string,
    dto: SetWeeklyAvailabilityDto,
  ): Promise<WeeklyAvailability[]> {
    const vendor = await this.requireVendor(userId);
    const normalized = this.validateWeeklyWindows(dto.windows ?? []);

    await this.prisma.$transaction([
      this.prisma.weeklyAvailability.deleteMany({
        where: { vendorId: vendor.id },
      }),
      this.prisma.weeklyAvailability.createMany({
        data: normalized.map((window) => ({
          vendorId: vendor.id,
          dayOfWeek: window.dayOfWeek,
          startMinute: window.startMinute,
          endMinute: window.endMinute,
        })),
      }),
    ]);

    return this.getWeeklyAvailability(userId);
  }

  async listOverrides(userId: string): Promise<AvailabilityOverride[]> {
    const vendor = await this.requireVendor(userId);
    return this.prisma.availabilityOverride.findMany({
      where: { vendorId: vendor.id },
      orderBy: { startsAt: 'asc' },
    });
  }

  async createOverride(
    userId: string,
    dto: CreateAvailabilityOverrideDto,
  ): Promise<AvailabilityOverride> {
    const vendor = await this.requireVendor(userId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('Invalid override times.');
    }
    if (startsAt >= endsAt) {
      throw new BadRequestException('Override end must be after start.');
    }
    if (endsAt.getTime() - startsAt.getTime() > 1000 * 60 * 60 * 24 * 7) {
      throw new BadRequestException('Overrides cannot exceed 7 days.');
    }

    return this.prisma.availabilityOverride.create({
      data: {
        vendorId: vendor.id,
        startsAt,
        endsAt,
        type: dto.type,
        reason: dto.reason?.trim() ?? null,
      },
    });
  }

  async deleteOverride(userId: string, overrideId: string): Promise<void> {
    const vendor = await this.requireVendor(userId);
    const existing = await this.prisma.availabilityOverride.findFirst({
      where: { id: overrideId, vendorId: vendor.id },
    });
    if (!existing) {
      throw new NotFoundException('Override not found.');
    }

    await this.prisma.availabilityOverride.delete({
      where: { id: existing.id },
    });
  }

  async listAvailabilitySlots(
    userId: string,
    query: AvailabilitySlotsQueryDto,
  ): Promise<
    {
      startAt: string;
      endAt: string;
    }[]
  > {
    const vendor = await this.requireVendor(userId);
    const service = await this.prisma.service.findFirst({
      where: { id: query.serviceId, vendorId: vendor.id, isActive: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found or inactive.');
    }

    const startDate = query.startDate ? new Date(query.startDate) : new Date();
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid start date.');
    }

    const days = query.days ?? 30;
    const rangeStart = this.startOfDayUtc(startDate);
    const rangeEnd = this.addDays(rangeStart, days);

    const [weeklyWindows, overrides] = await this.prisma.$transaction([
      this.prisma.weeklyAvailability.findMany({
        where: { vendorId: vendor.id },
      }),
      this.prisma.availabilityOverride.findMany({
        where: {
          vendorId: vendor.id,
          startsAt: { lt: rangeEnd },
          endsAt: { gt: rangeStart },
        },
      }),
    ]);

    if (weeklyWindows.length === 0) {
      return [];
    }

    return this.generateSlots({
      service,
      rangeStart,
      rangeEnd,
      weeklyWindows,
      overrides,
    }).map((slot) => ({
      startAt: slot.start.toISOString(),
      endAt: slot.end.toISOString(),
    }));
  }

  private async requireVendor(userId: string): Promise<VendorContext> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });

    if (!vendor) {
      throw new BadRequestException(
        'Complete vendor onboarding before managing services.',
      );
    }

    return { id: vendor.id };
  }

  private assertDuration(durationMinutes: number) {
    if (durationMinutes < 15 || durationMinutes > 8 * 60) {
      throw new BadRequestException(
        'Duration must be between 15 and 480 minutes.',
      );
    }
  }

  private assertBuffer(bufferMinutes: number) {
    if (bufferMinutes < 0 || bufferMinutes > 180) {
      throw new BadRequestException(
        'Buffer must be between 0 and 180 minutes.',
      );
    }
  }

  private validateWeeklyWindows(
    windows: AvailabilityWindowDto[],
  ): AvailabilityWindowDto[] {
    const normalized = windows
      .map((window) => ({
        dayOfWeek: window.dayOfWeek,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
      }))
      .filter((window) => window.startMinute < window.endMinute);

    const grouped = new Map<number, AvailabilityWindowDto[]>();
    for (const window of normalized) {
      if (!grouped.has(window.dayOfWeek)) {
        grouped.set(window.dayOfWeek, []);
      }
      grouped.get(window.dayOfWeek)!.push(window);
    }

    for (const [, dayWindows] of grouped) {
      dayWindows.sort((a, b) => a.startMinute - b.startMinute);
      for (let i = 0; i < dayWindows.length - 1; i += 1) {
        const current = dayWindows[i];
        const next = dayWindows[i + 1];
        if (current.endMinute > next.startMinute) {
          throw new BadRequestException(
            'Weekly availability windows cannot overlap.',
          );
        }
      }
    }

    return Array.from(grouped.values()).flat();
  }

  private generateSlots(params: {
    service: Service;
    rangeStart: Date;
    rangeEnd: Date;
    weeklyWindows: WeeklyAvailability[];
    overrides: AvailabilityOverride[];
  }): TimeWindow[] {
    const slots: TimeWindow[] = [];
    const weeklyByDay = this.groupWeeklyWindows(params.weeklyWindows);
    const overrides = params.overrides ?? [];

    let cursor = params.rangeStart;
    while (cursor < params.rangeEnd) {
      const dayStart = this.startOfDayUtc(cursor);
      const dayEnd = this.addDays(dayStart, 1);
      const dayOfWeek = dayStart.getUTCDay();
      const baseWindows = (weeklyByDay.get(dayOfWeek) ?? []).map((window) =>
        this.windowToDateRange(window, dayStart),
      );

      const dayOverrides = overrides.filter(
        (override) => override.startsAt < dayEnd && override.endsAt > dayStart,
      );

      const mergedWindows = this.applyOverrides(
        baseWindows,
        dayOverrides,
        dayStart,
        dayEnd,
      );

      const daySlots = this.generateSlotsWithinWindows(
        mergedWindows,
        params.service,
      );
      slots.push(...daySlots);

      cursor = this.addDays(cursor, 1);
    }

    return slots.filter(
      (slot) => slot.start >= params.rangeStart && slot.end <= params.rangeEnd,
    );
  }

  private groupWeeklyWindows(
    weekly: WeeklyAvailability[],
  ): Map<number, WeeklyAvailability[]> {
    const map = new Map<number, WeeklyAvailability[]>();
    for (const entry of weekly) {
      const key = entry.dayOfWeek;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(entry);
    }

    for (const [, windows] of map) {
      windows.sort((a, b) => a.startMinute - b.startMinute);
    }
    return map;
  }

  private windowToDateRange(
    window: WeeklyAvailability,
    dayStart: Date,
  ): TimeWindow {
    const start = new Date(dayStart.getTime() + window.startMinute * 60 * 1000);
    const end = new Date(dayStart.getTime() + window.endMinute * 60 * 1000);
    return { start, end };
  }

  private applyOverrides(
    baseWindows: TimeWindow[],
    overrides: AvailabilityOverride[],
    dayStart: Date,
    dayEnd: Date,
  ): TimeWindow[] {
    let windows = [...baseWindows];

    const addWindow = (window: TimeWindow) => {
      windows.push(window);
    };

    for (const override of overrides) {
      const clipped: TimeWindow = {
        start: new Date(
          Math.max(override.startsAt.getTime(), dayStart.getTime()),
        ),
        end: new Date(Math.min(override.endsAt.getTime(), dayEnd.getTime())),
      };

      if (clipped.start >= clipped.end) {
        continue;
      }

      if (override.type === AvailabilityOverrideType.EXTEND) {
        addWindow(clipped);
      } else if (override.type === AvailabilityOverrideType.BLOCK) {
        windows = windows.flatMap((window) =>
          this.subtractWindow(window, clipped),
        );
      }
    }

    return windows
      .filter((window) => window.start < window.end)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private subtractWindow(window: TimeWindow, block: TimeWindow): TimeWindow[] {
    if (block.end <= window.start || block.start >= window.end) {
      return [window];
    }

    // block fully covers window
    if (block.start <= window.start && block.end >= window.end) {
      return [];
    }

    // block overlaps start
    if (block.start <= window.start && block.end < window.end) {
      return [
        {
          start: block.end,
          end: window.end,
        },
      ];
    }

    // block overlaps end
    if (block.start > window.start && block.end >= window.end) {
      return [
        {
          start: window.start,
          end: block.start,
        },
      ];
    }

    // block splits window
    return [
      {
        start: window.start,
        end: block.start,
      },
      {
        start: block.end,
        end: window.end,
      },
    ].filter((segment) => segment.start < segment.end);
  }

  private generateSlotsWithinWindows(
    windows: TimeWindow[],
    service: Service,
  ): TimeWindow[] {
    const slots: TimeWindow[] = [];
    const durationMs = service.durationMinutes * 60 * 1000;
    const bufferMs = service.bufferMinutes * 60 * 1000;

    for (const window of windows) {
      let cursor = new Date(window.start);
      while (cursor.getTime() + durationMs <= window.end.getTime()) {
        const slotEnd = new Date(cursor.getTime() + durationMs);
        slots.push({ start: new Date(cursor), end: slotEnd });
        cursor = new Date(slotEnd.getTime() + bufferMs);
      }
    }

    return slots;
  }

  private startOfDayUtc(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }
}
