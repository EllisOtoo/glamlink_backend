import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import {
  Booking,
  BookingCancelActor,
  BookingStatus,
  PaymentIntent,
  PaymentProvider,
  PaymentStatus,
  Service,
  UserRole,
  Vendor,
  VendorStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma';
import { ServicesService } from '../services/services.service';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';
import { BookingEventsService } from '../events/booking-events.service';
import { CalendarService } from '../calendar/calendar.service';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.AWAITING_PAYMENT,
  BookingStatus.CONFIRMED,
];

const MIN_MODIFICATION_NOTICE_HOURS = 24;

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
      const seatAssignment = await this.resolveSeatAssignment(
        tx,
        vendor.id,
        service.id,
        start,
        scheduledEnd,
        dto.seatId,
      );

      if (!seatAssignment.hasSeatsConfigured) {
        await this.assertNoOverlap(tx, vendor.id, start, scheduledEnd);
      }

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
          seatId: seatAssignment.seatId,
          staffId: seatAssignment.staffId,
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

  async listCustomerCompletedBookings(userId: string, take = 10) {
    const limit = Math.min(Math.max(take, 1), 50);

    return this.prisma.booking.findMany({
      where: {
        customerUserId: userId,
        status: BookingStatus.COMPLETED,
      },
      include: {
        service: { select: { id: true, name: true, durationMinutes: true } },
        vendor: {
          select: { id: true, businessName: true, handle: true },
        },
        review: {
          select: { id: true },
        },
      },
      orderBy: { scheduledStart: 'desc' },
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

  async rescheduleBooking(
    user: User,
    bookingId: string,
    dto: RescheduleBookingDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { vendor: true, service: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    this.assertBookingOwnership(user, booking);
    this.assertWithinModificationWindow(booking.scheduledStart);

    if (
      booking.status !== BookingStatus.CONFIRMED &&
      booking.status !== BookingStatus.AWAITING_PAYMENT
    ) {
      throw new BadRequestException(
        'Only active bookings can be rescheduled.',
      );
    }

    const newStart = new Date(dto.startAt);
    if (Number.isNaN(newStart.getTime())) {
      throw new BadRequestException('Provide a valid start time.');
    }

    const newStartIso = newStart.toISOString();
    await this.ensureSlotIsAvailable(booking.vendor, booking.service, newStartIso);
    const newEnd = new Date(
      newStart.getTime() + booking.service.durationMinutes * 60 * 1000,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.assertNoOverlap(
        tx,
        booking.vendorId,
        newStart,
        newEnd,
        booking.id,
      );

      return tx.booking.update({
        where: { id: booking.id },
        data: {
          scheduledStart: newStart,
          scheduledEnd: newEnd,
          rescheduledAt: new Date(),
          rescheduleCount: { increment: 1 },
        },
      });
    });

    await this.calendarService.syncEntriesForBooking(updated);
    this.bookingEvents.emitRescheduled(updated, {
      previousStart: booking.scheduledStart.toISOString(),
      previousEnd: booking.scheduledEnd.toISOString(),
    });

    return updated;
  }

  async cancelBooking(user: User, bookingId: string, dto: CancelBookingDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { vendor: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking already cancelled.');
    }

    this.assertBookingOwnership(user, booking);
    this.assertWithinModificationWindow(booking.scheduledStart);

    const actor = this.resolveCancellationActor(user, booking);
    const cancellationReason =
      dto.reason && dto.reason.trim().length > 0 ? dto.reason.trim() : null;

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: actor,
        cancellationReason,
      },
    });

    await this.calendarService.syncEntriesForBooking(updated);
    this.bookingEvents.emitCancelled(updated, { reason: cancellationReason });

    return updated;
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

  private async resolveSeatAssignment(
    tx: Prisma.TransactionClient,
    vendorId: string,
    serviceId: string,
    start: Date,
    end: Date,
    requestedSeatId?: string,
  ): Promise<{
    seatId: string | null;
    staffId: string | null;
    hasSeatsConfigured: boolean;
  }> {
    const seats = await tx.serviceSeat.findMany({
      where: {
        vendorId,
        isActive: true,
        OR: [
          { services: { some: { serviceId } } },
          { services: { none: {} } },
        ],
      },
      include: {
        staff: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (seats.length === 0) {
      return { seatId: null, staffId: null, hasSeatsConfigured: false };
    }

    const legacyOverlap = await tx.booking.findFirst({
      where: {
        vendorId,
        seatId: null,
        status: { in: ACTIVE_BOOKING_STATUSES },
        scheduledStart: { lt: end },
        scheduledEnd: { gt: start },
      },
    });

    if (legacyOverlap) {
      throw new BadRequestException(
        'This time slot is no longer available.',
      );
    }

    const seatIds = seats.map((seat) => seat.id);
    const overlappingCounts = seatIds.length
      ? await tx.booking.groupBy({
          by: ['seatId'],
          where: {
            seatId: { in: seatIds },
            status: { in: ACTIVE_BOOKING_STATUSES },
            scheduledStart: { lt: end },
            scheduledEnd: { gt: start },
          },
          _count: { _all: true },
        })
      : [];

    const seatAvailable = (seat: typeof seats[number]) => {
      const capacity = seat.capacity && seat.capacity > 0 ? seat.capacity : 1;
      const active = overlappingCounts.find(
        (entry) => entry.seatId === seat.id,
      );
      const currentCount = active?._count._all ?? 0;
      return currentCount < capacity;
    };

    const findSeatOrThrow = (seatId: string) => {
      const seat = seats.find((candidate) => candidate.id === seatId);
      if (!seat) {
        throw new BadRequestException('Selected seat is not available.');
      }
      if (!seatAvailable(seat)) {
        throw new BadRequestException(
          'Selected seat is no longer free for that slot.',
        );
      }
      return seat;
    };

    if (requestedSeatId) {
      const seat = findSeatOrThrow(requestedSeatId);
      return {
        seatId: seat.id,
        staffId: seat.staffId ?? null,
        hasSeatsConfigured: true,
      };
    }

    const availableSeat = seats.find((seat) => seatAvailable(seat));
    if (!availableSeat) {
      throw new BadRequestException(
        'No seats are available for this time slot.',
      );
    }

    return {
      seatId: availableSeat.id,
      staffId: availableSeat.staffId ?? null,
      hasSeatsConfigured: true,
    };
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
    excludeBookingId?: string,
  ) {
    const conflicting = await tx.booking.findFirst({
      where: {
        vendorId,
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
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

  private assertBookingOwnership(
    user: User,
    booking: Booking & { vendor: Vendor },
  ) {
    const isVendorOwner =
      user.role === UserRole.VENDOR && booking.vendor.userId === user.id;
    const isCustomerOwner = booking.customerUserId === user.id;

    if (!isVendorOwner && !isCustomerOwner) {
      throw new ForbiddenException('You cannot manage this booking.');
    }

    if (!booking.vendor.userId) {
      throw new BadRequestException(
        'Vendor account is not linked to an active user.',
      );
    }
  }

  private assertWithinModificationWindow(scheduledStart: Date) {
    const now = new Date();
    const noticeMs = scheduledStart.getTime() - now.getTime();
    if (noticeMs < MIN_MODIFICATION_NOTICE_HOURS * 60 * 60 * 1000) {
      throw new BadRequestException(
        `Changes are only allowed ${MIN_MODIFICATION_NOTICE_HOURS}+ hours before the appointment.`,
      );
    }
  }

  private resolveCancellationActor(
    user: User,
    booking: Booking & { vendor: Vendor },
  ): BookingCancelActor {
    if (booking.vendor.userId === user.id) {
      return BookingCancelActor.VENDOR;
    }

    if (booking.customerUserId === user.id) {
      return BookingCancelActor.CUSTOMER;
    }

    return BookingCancelActor.SYSTEM;
  }
}
