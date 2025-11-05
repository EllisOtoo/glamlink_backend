import { AvailabilityOverrideType } from '@prisma/client';
import { ServicesService } from './services.service';
import type { PrismaService } from '../prisma';

type MockedPrisma = {
  vendor: { findUnique: jest.Mock };
  service: { findFirst: jest.Mock };
  weeklyAvailability: { findMany: jest.Mock };
  availabilityOverride: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

const createMockPrisma = (): MockedPrisma => ({
  vendor: { findUnique: jest.fn() },
  service: { findFirst: jest.fn() },
  weeklyAvailability: { findMany: jest.fn() },
  availabilityOverride: { findMany: jest.fn() },
  $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
    Promise.all(operations),
  ),
});

describe('ServicesService availability slots', () => {
  let prisma: MockedPrisma;
  let service: ServicesService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ServicesService(prisma as unknown as PrismaService);

    prisma.vendor.findUnique.mockResolvedValue({ id: 'vnd_123' });
    prisma.service.findFirst.mockResolvedValue({
      id: 'svc_123',
      vendorId: 'vnd_123',
      name: 'Bridal Makeup',
      description: null,
      priceCents: 35000,
      durationMinutes: 120,
      bufferMinutes: 30,
      isActive: true,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    prisma.weeklyAvailability.findMany.mockResolvedValue([
      {
        id: 'wav_mon',
        vendorId: 'vnd_123',
        dayOfWeek: 1,
        startMinute: 540,
        endMinute: 1020,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    ]);

    prisma.availabilityOverride.findMany.mockResolvedValue([]);
  });

  it('returns identical slot windows when called repeatedly with the same inputs', async () => {
    const query = {
      serviceId: 'svc_123',
      startDate: '2025-01-06T00:00:00.000Z',
      days: 1,
    };

    const first = await service.listAvailabilitySlots('usr_vendor', query);
    const second = await service.listAvailabilitySlots('usr_vendor', query);

    expect(first).toEqual(second);
    expect(first).toStrictEqual([
      {
        startAt: '2025-01-06T09:00:00.000Z',
        endAt: '2025-01-06T11:00:00.000Z',
      },
      {
        startAt: '2025-01-06T11:30:00.000Z',
        endAt: '2025-01-06T13:30:00.000Z',
      },
      {
        startAt: '2025-01-06T14:00:00.000Z',
        endAt: '2025-01-06T16:00:00.000Z',
      },
    ]);
  });

  it('never produces overlapping slots, even with overrides applied', async () => {
    prisma.availabilityOverride.findMany.mockResolvedValue([
      {
        id: 'aov_block',
        vendorId: 'vnd_123',
        startsAt: new Date('2025-01-06T11:00:00.000Z'),
        endsAt: new Date('2025-01-06T12:00:00.000Z'),
        type: AvailabilityOverrideType.BLOCK,
        reason: 'Lunch break',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    ]);

    const slots = await service.listAvailabilitySlots('usr_vendor', {
      serviceId: 'svc_123',
      startDate: '2025-01-06T00:00:00.000Z',
      days: 1,
    });

    for (let index = 0; index < slots.length - 1; index += 1) {
      const currentEnd = new Date(slots[index].endAt).getTime();
      const nextStart = new Date(slots[index + 1].startAt).getTime();
      expect(currentEnd).toBeLessThanOrEqual(nextStart);
    }
  });
});
