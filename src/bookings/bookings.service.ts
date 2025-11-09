import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  Booking,
  BookingStatus,
  PaymentIntent,
  PaymentProvider,
  PaymentStatus,
  Service,
  Vendor,
  VendorStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma';
import { ServicesService } from '../services/services.service';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.AWAITING_PAYMENT,
  BookingStatus.CONFIRMED,
];

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servicesService: ServicesService,
  ) {}

  async createPublicBooking(
    dto: CreatePublicBookingDto,
  ): Promise<Booking & { paymentIntent: PaymentIntent | null }> {
    const start = new Date(dto.startAt);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('Invalid booking start time.');
    }
    const startIso = start.toISOString();

    const { service, vendor } = await this.findServiceAndVendor(dto.serviceId);
    const slot = await this.ensureSlotIsAvailable(vendor, service, startIso);
    const scheduledEnd = new Date(slot.endAt);
    if (Number.isNaN(scheduledEnd.getTime())) {
      throw new BadRequestException('Selected slot end time is invalid.');
    }

    const expectedEnd = new Date(
      start.getTime() + service.durationMinutes * 60 * 1000,
    );
    if (expectedEnd.getTime() !== scheduledEnd.getTime()) {
      throw new BadRequestException(
        'Selected slot duration no longer matches the service.',
      );
    }

    const price = this.assertPositiveInt(service.priceCents);
    const depositPercent = this.resolveDepositPercent(service.depositPercent);
    const deposit = Math.min(price, Math.floor((price * depositPercent) / 100));
    const balance = price - deposit;

    const trimmedName = dto.customerName.trim();
    if (trimmedName.length === 0) {
      throw new BadRequestException('Customer name is required.');
    }

    const reference = `book_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

    const booking = await this.prisma.$transaction(async (tx) => {
      await this.assertNoOverlap(tx, vendor.id, start, scheduledEnd);

      const created = await tx.booking.create({
        data: {
          reference,
          vendorId: vendor.id,
          serviceId: service.id,
          customerName: trimmedName,
          customerEmail: dto.customerEmail?.trim().toLowerCase() ?? null,
          customerPhone: dto.customerPhone?.trim() ?? null,
          status:
            deposit > 0 ? BookingStatus.AWAITING_PAYMENT : BookingStatus.CONFIRMED,
          scheduledStart: start,
          scheduledEnd,
          pricePesewas: price,
          depositPesewas: deposit,
          balancePesewas: balance,
          notes: dto.notes?.trim() ?? null,
        },
      });

      if (deposit > 0) {
        await tx.paymentIntent.create({
          data: {
            bookingId: created.id,
            provider: PaymentProvider.PAYSTACK,
            providerRef: reference,
            amountPesewas: deposit,
            status: PaymentStatus.REQUIRES_PAYMENT_METHOD,
            currency: 'GHS',
            metadata: {
              bookingId: created.id,
              vendorId: vendor.id,
              serviceId: service.id,
              customerEmail: dto.customerEmail?.trim().toLowerCase() ?? null,
            } as Prisma.InputJsonValue,
          },
        });
      }

      return created;
    });

    const persisted = await this.prisma.booking.findUnique({
      where: { id: booking.id },
      include: { paymentIntent: true },
    });

    if (!persisted) {
      throw new NotFoundException('Booking could not be retrieved after creation.');
    }

    return persisted;
  }

  private async findServiceAndVendor(
    serviceId: string,
  ): Promise<{ service: Service; vendor: Vendor }> {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        vendor: true,
      },
    });

    if (!service || !service.isActive) {
      throw new NotFoundException('Service not found or inactive.');
    }

    if (!service.vendor) {
      throw new BadRequestException('Service vendor is missing.');
    }

    if (service.vendor.status !== VendorStatus.VERIFIED) {
      throw new BadRequestException(
        'Vendor must be verified before accepting bookings.',
      );
    }

    if (!service.vendor.userId) {
      throw new BadRequestException(
        'Vendor account is not linked to an active user.',
      );
    }

    return { service, vendor: service.vendor };
  }

  private async ensureSlotIsAvailable(
    vendor: Vendor,
    service: Service,
    startIso: string,
  ) {
    const slots = await this.servicesService.listAvailabilitySlots(vendor.userId!, {
      serviceId: service.id,
      startDate: startIso,
      days: 1,
    });

    const slot = slots.find((candidate) => candidate.startAt === startIso);
    if (!slot) {
      throw new BadRequestException('Selected slot is no longer available.');
    }

    return slot;
  }

  private async assertNoOverlap(
    tx: Prisma.TransactionClient,
    vendorId: string,
    start: Date,
    end: Date,
  ) {
    const conflicting = await tx.booking.findFirst({
      where: {
        vendorId,
        status: { in: ACTIVE_BOOKING_STATUSES },
        scheduledStart: { lt: end },
        scheduledEnd: { gt: start },
      },
    });

    if (conflicting) {
      throw new BadRequestException(
        'Another booking already occupies this time window.',
      );
    }
  }

  private resolveDepositPercent(depositPercent?: number | null): number {
    if (typeof depositPercent !== 'number') {
      return 100;
    }

    if (depositPercent < 0) {
      return 0;
    }

    if (depositPercent > 100) {
      return 100;
    }

    return depositPercent;
  }

  private assertPositiveInt(amount: number): number {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Service price must be greater than zero.');
    }
    return amount;
  }
}
