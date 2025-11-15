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
import { BookingEventsService } from '../events/booking-events.service';
import { CalendarService } from '../calendar/calendar.service';
import type { User } from '@prisma/client';

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
    private readonly bookingEvents: BookingEventsService,
    private readonly calendarService: CalendarService,
  ) {}

  async createPublicBooking(
    dto: CreatePublicBookingDto,
    customerUserId?: string | null,
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
          customerUserId: customerUserId ?? null,
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

    await this.calendarService.syncEntriesForBooking(persisted);
    this.bookingEvents.emitCreated(persisted);
    if (persisted.status === BookingStatus.AWAITING_PAYMENT) {
      this.bookingEvents.emitAwaitingPayment(persisted);
    }
    if (persisted.status === BookingStatus.CONFIRMED) {
      this.bookingEvents.emitConfirmed(persisted);
    }

    return persisted;
  }

  async listVendorUpcomingBookings(userId: string, take = 10) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found.');
    }

    const limit = Math.min(Math.max(take, 1), 50);
    const now = new Date();

    return this.prisma.booking.findMany({
      where: {
        vendorId: vendor.id,
        status: { in: ACTIVE_BOOKING_STATUSES },
        scheduledEnd: { gte: now },
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            durationMinutes: true,
          },
        },
      },
      orderBy: { scheduledStart: 'asc' },
      take: limit,
    });
  }

  async listCustomerUpcomingBookings(userId: string, take = 10) {
    const limit = Math.min(Math.max(take, 1), 50);
    const now = new Date();

    return this.prisma.booking.findMany({
      where: {
        customerUserId: userId,
        status: { in: ACTIVE_BOOKING_STATUSES },
        scheduledEnd: { gte: now },
      },
      include: {
        service: {
          select: { id: true, name: true, durationMinutes: true },
        },
        vendor: {
          select: { id: true, businessName: true, handle: true },
        },
      },
      orderBy: { scheduledStart: 'asc' },
      take: limit,
    });
  }

  async claimBookingsForCustomer(
    user: User,
    params: { email?: string; phone?: string },
  ) {
    const normalizedEmail =
      params.email?.trim().toLowerCase() ?? user.email?.toLowerCase() ?? null;
    const normalizedPhone = params.phone?.trim();

    if (!normalizedEmail && !normalizedPhone) {
      throw new BadRequestException(
        'Provide an email or phone number to search for bookings.',
      );
    }

    const conditions: Prisma.BookingWhereInput[] = [];

    if (normalizedEmail) {
      conditions.push({ customerEmail: normalizedEmail });
    }

    if (normalizedPhone) {
      conditions.push({ customerPhone: normalizedPhone });
    }

    const matches = await this.prisma.booking.findMany({
      where: {
        customerUserId: null,
        OR: conditions,
      },
      select: { id: true },
      take: 20,
    });

    if (matches.length === 0) {
      return [];
    }

    const ids = matches.map((booking) => booking.id);

    await this.prisma.booking.updateMany({
      where: { id: { in: ids } },
      data: { customerUserId: user.id },
    });

    const updatedBookings = await this.prisma.booking.findMany({
      where: { id: { in: ids } },
      include: {
        service: { select: { id: true, name: true, durationMinutes: true } },
        vendor: { select: { id: true, businessName: true, handle: true } },
      },
      orderBy: { scheduledStart: 'desc' },
    });

    await this.calendarService.syncEntriesForBookings(updatedBookings);

    return updatedBookings;
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
