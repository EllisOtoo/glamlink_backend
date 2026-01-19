import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { VendorStatus, VendorPaymentMode, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';
import { StorageService } from '../storage/storage.service';
import { ServicesService } from '../services/services.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import type { DiscoverServicesQueryDto } from './dto/discover-services.dto';
import type { NearbyServicesQueryDto } from './dto/nearby-services.dto';
import type { ServiceReviewsQueryDto } from './dto/service-reviews.dto';

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export interface VendorSummary {
  id: string;
  businessName: string;
  handle: string;
  locationArea: string | null;
  bio: string | null;
  logoUrl: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  startingPriceCents: number | null;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusKm: number | null;
  professionalTitle: string | null;
  yearsExperience: number | null;
  isVerified: boolean;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  facebookUrl: string | null;
  xHandle: string | null;
  youtubeChannel: string | null;
  bookingCount: number;
  travelsNationally: boolean;
  travelFeePerKmPesewas: number | null;
  paymentMode: 'FULL_UPFRONT' | 'DEPOSIT_REQUIRED';
  defaultDepositPercent: number | null;
}

export interface ServiceImageSummary {
  id: string;
  imageUrl: string;
  caption: string | null;
  width: number | null;
  height: number | null;
}

export interface PortfolioItemSummary {
  id: string;
  url: string;
  type: string;
  externalUrl: string | null;
  caption: string | null;
}

export interface ServiceSummary {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMinutes: number;
  vendor: VendorSummary;
  images: ServiceImageSummary[];
  includes: string[];
  createdAt: Date;
  bookingCount: number;
  ratingAverage: number | null;
  ratingCount: number;
}

export interface NearbyServiceSummary extends ServiceSummary {
  distanceKm: number;
}

export interface SeatStaffSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
}

export interface SeatSummary {
  id: string;
  label: string;
  description: string | null;
  capacity: number;
  staff: SeatStaffSummary | null;
}

export interface ServiceDetailSummary extends ServiceSummary {
  seats: SeatSummary[];
  ratingAverage: number | null;
  ratingCount: number;
  ratingHistogram: number[];
  recentReviews: ServiceReview[];
  bookingCount: number;
}

export interface VendorDetailSummary extends VendorSummary {
  services: ServiceSummary[];
  recentReviews: ServiceReview[];
}

export interface ServiceAvailabilitySlot {
  startAt: string;
  endAt: string;
  availableSeats: number;
  seats: {
    seatId: string;
    label: string;
    capacity: number;
    bookedCount: number;
    available: boolean;
    staff: SeatStaffSummary | null;
  }[];
}

type ReviewAggregate = {
  vendorId: string;
  _avg: { rating: number | null };
  _count: { rating: number };
};

export interface ServiceReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  imageUrls: string[];
  author: {
    name: string;
    initials: string;
  };
  vendorReply: {
    message: string;
    repliedAt: string | null;
  } | null;
}

export interface ServiceReviewsResponse {
  reviews: ServiceReview[];
  nextCursor: string | null;
  rating: {
    average: number | null;
    count: number;
    histogram: number[];
  };
}

type VendorSummarySource = {
  id: string;
  businessName: string;
  handle: string;
  locationArea: string | null;
  bio: string | null;
  logoStorageKey: string | null;
  logoVersion: number | null;
  latitude?: number | null;
  longitude?: number | null;
  serviceRadiusKm?: number | null;
  professionalTitle: string | null;
  yearsExperience: number | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  facebookUrl: string | null;
  xHandle: string | null;
  youtubeChannel: string | null;
  status: VendorStatus;
  services: { priceCents: number }[];
  bookingCount: number;
  ratingAverage: number | null;
  ratingCount: number;
  travelsNationally?: boolean;
  travelFeePerKmPesewas?: number | null;
  paymentMode: VendorPaymentMode;
  defaultDepositPercent?: number | null;
};

const SERVICE_INCLUDE = {
  vendor: {
    select: {
      id: true,
      businessName: true,
      handle: true,
      locationArea: true,
      bio: true,
      status: true,
      logoStorageKey: true,
      logoVersion: true,
      latitude: true,
      longitude: true,
      serviceRadiusKm: true,
      professionalTitle: true,
      yearsExperience: true,
      instagramHandle: true,
      tiktokHandle: true,
      facebookUrl: true,
      xHandle: true,
      youtubeChannel: true,
      bookingCount: true,
      ratingAverage: true,
      ratingCount: true,
      travelsNationally: true,
      travelFeePerKmPesewas: true,
      paymentMode: true,
      defaultDepositPercent: true,
      services: {
        where: { isActive: true },
        select: { priceCents: true },
      },
    },
  },
  images: {
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      storageKey: true,
      caption: true,
      width: true,
      height: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ServiceInclude;

type ServiceWithRelations = Prisma.ServiceGetPayload<{
  include: typeof SERVICE_INCLUDE;
}>;

@Injectable()
export class PublicCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly servicesService: ServicesService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async listCategories(): Promise<CategorySummary[]> {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
      },
    });
  }

  async highlightVendors(limit = 6): Promise<VendorSummary[]> {
    const markupBps = await this.platformSettings.getServiceMarkupBps();
    const vendors = await this.prisma.vendor.findMany({
      where: {
        status: { in: [VendorStatus.VERIFIED, VendorStatus.DRAFT, VendorStatus.PENDING_REVIEW] },
        services: {
          some: { isActive: true },
        },
      },
      orderBy: [{ verifiedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        businessName: true,
        handle: true,
        locationArea: true,
        bio: true,
        status: true,
        logoStorageKey: true,
        logoVersion: true,
        latitude: true,
        longitude: true,
        serviceRadiusKm: true,
        professionalTitle: true,
        yearsExperience: true,
        instagramHandle: true,
        tiktokHandle: true,
        facebookUrl: true,
        xHandle: true,
        youtubeChannel: true,
        bookingCount: true,
        ratingAverage: true,
        ratingCount: true,
        paymentMode: true,
        defaultDepositPercent: true,
        services: {
          where: { isActive: true },
          select: { priceCents: true },
        },
      },
    });

    const vendorIds = vendors.map((vendor) => vendor.id);

    const reviewAggregates =
      vendorIds.length === 0
        ? []
        : await this.prisma.review.groupBy({
            by: ['vendorId'],
            where: { vendorId: { in: vendorIds } },
            _avg: { rating: true },
            _count: { rating: true },
          });

    return this.mapVendorSummaries(vendors, reviewAggregates, markupBps);
  }

  async searchVendorsByHandle(
    handle: string,
    limit = 5,
  ): Promise<VendorSummary[]> {
    const normalizedHandle = this.normalizeHandle(handle);

    if (!normalizedHandle) {
      throw new BadRequestException('Handle is required to search vendors.');
    }

    const markupBps = await this.platformSettings.getServiceMarkupBps();
    const vendors = await this.prisma.vendor.findMany({
      where: {
        status: { in: [VendorStatus.VERIFIED, VendorStatus.DRAFT, VendorStatus.PENDING_REVIEW] },
        handle: {
          contains: normalizedHandle,
          mode: 'insensitive',
        },
        services: {
          some: { isActive: true },
        },
      },
      orderBy: [{ handle: 'asc' }],
      take: limit,
      select: {
        id: true,
        businessName: true,
        handle: true,
        locationArea: true,
        bio: true,
        status: true,
        logoStorageKey: true,
        logoVersion: true,
        latitude: true,
        longitude: true,
        serviceRadiusKm: true,
        professionalTitle: true,
        yearsExperience: true,
        instagramHandle: true,
        tiktokHandle: true,
        facebookUrl: true,
        xHandle: true,
        youtubeChannel: true,
        bookingCount: true,
        ratingAverage: true,
        ratingCount: true,
        paymentMode: true,
        defaultDepositPercent: true,
        services: {
          where: { isActive: true },
          select: { priceCents: true },
        },
      },
    });

    const vendorIds = vendors.map((vendor) => vendor.id);

    const reviewAggregates =
      vendorIds.length === 0
        ? []
        : await this.prisma.review.groupBy({
            by: ['vendorId'],
            where: { vendorId: { in: vendorIds } },
            _avg: { rating: true },
            _count: { rating: true },
          });

    return this.mapVendorSummaries(vendors, reviewAggregates, markupBps);
  }

  async getVendorByHandle(handle: string): Promise<VendorDetailSummary> {
    const normalizedHandle = this.normalizeHandle(handle);

    if (!normalizedHandle) {
      throw new NotFoundException('Vendor not found.');
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { handle: normalizedHandle },
      select: {
        id: true,
        businessName: true,
        handle: true,
        locationArea: true,
        bio: true,
        status: true,
        logoStorageKey: true,
        logoVersion: true,
        latitude: true,
        longitude: true,
        serviceRadiusKm: true,
        professionalTitle: true,
        yearsExperience: true,
        instagramHandle: true,
        tiktokHandle: true,
        facebookUrl: true,
        xHandle: true,
        youtubeChannel: true,
        bookingCount: true,
        ratingAverage: true,
        ratingCount: true,
        paymentMode: true,
        defaultDepositPercent: true,
      services: {
        where: { isActive: true },
        select: { priceCents: true },
      },
    },
  });

    if (!vendor || (vendor.status !== VendorStatus.VERIFIED && vendor.status !== VendorStatus.DRAFT && vendor.status !== VendorStatus.PENDING_REVIEW)) {
      throw new NotFoundException('Vendor not found.');
    }

    const services = await this.prisma.service.findMany({
      where: { vendorId: vendor.id, isActive: true },
      orderBy: [{ createdAt: 'desc' }],
      include: SERVICE_INCLUDE,
    });

    const recentReviews = await this.listVendorReviews(vendor.id, { take: 3 });

    const markupBps = await this.platformSettings.getServiceMarkupBps();
    const vendorSummary = this.mapVendorSummary(vendor, [], markupBps);
    const serviceSummaries = services.map((service) =>
      this.mapServiceSummary(service, [], markupBps),
    );

    return {
      ...vendorSummary,
      services: serviceSummaries,
      recentReviews,
    };
  }

  async getVendorPortfolio(handle: string, limit?: number): Promise<PortfolioItemSummary[]> {
    const normalizedHandle = this.normalizeHandle(handle);

    if (!normalizedHandle) {
      throw new NotFoundException('Vendor not found.');
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { handle: normalizedHandle },
      select: { id: true, status: true },
    });

    if (!vendor || (vendor.status !== VendorStatus.VERIFIED && vendor.status !== VendorStatus.DRAFT && vendor.status !== VendorStatus.PENDING_REVIEW)) {
      throw new NotFoundException('Vendor not found.');
    }

    const items = await this.prisma.portfolioItem.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'desc' },
      take: limit && limit > 0 ? limit : undefined,
      include: {
        services: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                priceCents: true,
                durationMinutes: true,
              },
            },
          },
        },
      },
    });

    return items.map((item) => ({
      id: item.id,
      url: item.storageKey ? this.storage.buildPublicUrl(item.storageKey) : (item.externalUrl ?? ''),
      type: item.type,
      externalUrl: item.externalUrl ?? null,
      caption: item.caption ?? null,
      services: item.services.map((s) => ({
        service: s.service,
      })),
    }));
  }

  async discoverServices(
    query: DiscoverServicesQueryDto,
  ): Promise<ServiceSummary[]> {
    const vendorWhere: Prisma.VendorWhereInput = {
      status: { in: [VendorStatus.VERIFIED, VendorStatus.DRAFT, VendorStatus.PENDING_REVIEW] },
    };

    if (query.location) {
      vendorWhere.locationArea = {
        contains: query.location,
        mode: 'insensitive',
      };
    }

    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      vendor: {
        is: vendorWhere,
      },
    };

    if (query.q) {
      where.name = { contains: query.q, mode: 'insensitive' };
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    const limit = query.limit ?? 12;
    const offset = query.offset ?? 0;

    const markupBps = await this.platformSettings.getServiceMarkupBps();

    const services = await this.prisma.service.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      skip: offset,
      include: SERVICE_INCLUDE,
    });

    const vendorIds = services
      .map((service) => service.vendor?.id)
      .filter((id): id is string => Boolean(id));

    const reviewAggregates =
      vendorIds.length === 0
        ? []
        : await this.prisma.review.groupBy({
            by: ['vendorId'],
            where: { vendorId: { in: vendorIds } },
            _avg: { rating: true },
            _count: { rating: true },
          });

    return services
      .filter((service) => service.vendor)
      .map((service) =>
        this.mapServiceSummary(service, reviewAggregates, markupBps),
      );
  }

  async discoverNearbyServices(
    query: NearbyServicesQueryDto,
  ): Promise<NearbyServiceSummary[]> {
    const { latitude, longitude } = query;
    const radiusKm = query.radiusKm ?? 15;
    const includeTravelVendors = query.includeTravelVendors !== false; // Default true
    const travelVendorsOnly = query.travelVendorsOnly === true;

    const markupBps = await this.platformSettings.getServiceMarkupBps();

    // Build vendor filter based on travel mode
    const vendorFilter: Prisma.VendorWhereInput = {
      status: { in: [VendorStatus.VERIFIED, VendorStatus.DRAFT, VendorStatus.PENDING_REVIEW] },
    };

    if (travelVendorsOnly) {
      // Only travel vendors
      vendorFilter.travelsNationally = true;
    } else if (includeTravelVendors) {
      // Both local (with coords) and travel vendors
      vendorFilter.OR = [
        { latitude: { not: null }, longitude: { not: null } },
        { travelsNationally: true },
      ];
    } else {
      // Only local vendors with coordinates
      vendorFilter.latitude = { not: null };
      vendorFilter.longitude = { not: null };
    }

    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      vendor: vendorFilter,
    };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    const services = await this.prisma.service.findMany({
      where,
      take: 200,
      orderBy: [{ updatedAt: 'desc' }],
      include: SERVICE_INCLUDE,
    });

    const vendorIds = services
      .map((service) => service.vendor?.id)
      .filter((id): id is string => Boolean(id));

    const reviewAggregates =
      vendorIds.length === 0
        ? []
        : await this.prisma.review.groupBy({
            by: ['vendorId'],
            where: { vendorId: { in: vendorIds } },
            _avg: { rating: true },
            _count: { rating: true },
          });

    // Process services - travel vendors get distanceKm=0, local vendors calculated
    const withDistance = services
      .filter((service) => Boolean(service.vendor))
      .map((service) => {
        const vendor = service.vendor!;
        const isTravelVendor = vendor.travelsNationally === true;

        // Travel vendors: no distance restriction, show at top (distanceKm = 0)
        if (isTravelVendor) {
          // Calculate actual distance if vendor has coords (for display purposes)
          let displayDistance = 0;
          if (
            typeof vendor.latitude === 'number' &&
            typeof vendor.longitude === 'number'
          ) {
            displayDistance = this.calculateDistanceKm(
              latitude,
              longitude,
              vendor.latitude,
              vendor.longitude,
            );
          }
          return { service, distanceKm: displayDistance, isTravelVendor: true };
        }

        // Local vendors: calculate distance
        if (
          typeof vendor.latitude !== 'number' ||
          typeof vendor.longitude !== 'number'
        ) {
          return null; // Skip local vendors without coords
        }

        const distanceKm = this.calculateDistanceKm(
          latitude,
          longitude,
          vendor.latitude,
          vendor.longitude,
        );
        return { service, distanceKm, isTravelVendor: false };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter(({ distanceKm, isTravelVendor, service }) => {
        // Travel vendors: no radius restrictions
        if (isTravelVendor) return true;

        // Local vendors: apply radius filters
        if (distanceKm > radiusKm) return false;
        const vendorRadius = service.vendor?.serviceRadiusKm;
        if (
          typeof vendorRadius === 'number' &&
          vendorRadius > 0 &&
          distanceKm > vendorRadius
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Travel vendors first, then by rating or distance
        if (a.isTravelVendor && !b.isTravelVendor) return -1;
        if (!a.isTravelVendor && b.isTravelVendor) return 1;

        if (query.sortBy === 'rating') {
          const ratingA =
            reviewAggregates.find((r) => r.vendorId === a.service.vendor?.id)
              ?._avg.rating ?? 0;
          const ratingB =
            reviewAggregates.find((r) => r.vendorId === b.service.vendor?.id)
              ?._avg.rating ?? 0;
          if (ratingA !== ratingB) {
            return ratingB - ratingA;
          }
        }
        return a.distanceKm - b.distanceKm;
      })
      .slice(0, 24);

    return withDistance.map(({ service, distanceKm }) => ({
      ...this.mapServiceSummary(service, reviewAggregates, markupBps),
      distanceKm,
    }));
  }

  async listServicesForVendor(userId: string): Promise<ServiceSummary[]> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      select: {
        id: true,
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found.');
    }

    const services = await this.prisma.service.findMany({
      where: { vendorId: vendor.id, isActive: true },
      orderBy: [{ createdAt: 'desc' }],
      include: SERVICE_INCLUDE,
    });

    const reviewAggregates =
      services.length === 0
        ? []
        : await this.prisma.review.groupBy({
            by: ['vendorId'],
            where: { vendorId: vendor.id },
            _avg: { rating: true },
            _count: { rating: true },
          });

    const markupBps = await this.platformSettings.getServiceMarkupBps();

    return services.map((service) =>
      this.mapServiceSummary(service, reviewAggregates, markupBps),
    );
  }

  private mapServiceSummary(
    service: ServiceWithRelations,
    reviewAggregates: ReviewAggregate[],
    markupBps: number,
  ): ServiceSummary {
    const summary = reviewAggregates.find(
      (aggregate) => aggregate.vendorId === service.vendor.id,
    );

    return {
      id: service.id,
      name: service.name,
      description: service.description ?? null,
      priceCents: this.applyMarkup(service.priceCents, markupBps),
      durationMinutes: service.durationMinutes,
      vendor: this.mapVendorSummary(service.vendor, reviewAggregates, markupBps),
      images: service.images.map((image) => ({
        id: image.id,
        caption: image.caption ?? null,
        imageUrl: this.storage.buildPublicUrl(
          image.storageKey,
          Math.floor(image.updatedAt.getTime() / 1000),
        ),
        width: image.width ?? null,
        height: image.height ?? null,
      })),
      includes: service.includes,
      createdAt: service.createdAt,
      bookingCount: service.bookingCount,
      ratingAverage: (service as any).ratingAverage ?? null,
      ratingCount: (service as any).ratingCount ?? 0,
    };
  }

  private async listSeatsForService(
    vendorId: string,
    serviceId: string,
  ): Promise<SeatSummary[]> {
    const seats = await this.prisma.serviceSeat.findMany({
      where: {
        vendorId,
        isActive: true,
        OR: [{ services: { some: { serviceId } } }, { services: { none: {} } }],
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            avatarStorageKey: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return seats.map((seat) => ({
      id: seat.id,
      label: seat.label,
      description: seat.description ?? null,
      capacity: seat.capacity && seat.capacity > 0 ? seat.capacity : 1,
      staff: seat.staff
        ? {
            id: seat.staff.id,
            name: seat.staff.name,
            bio: seat.staff.bio ?? null,
            avatarUrl: seat.staff.avatarStorageKey
              ? this.storage.buildPublicUrl(seat.staff.avatarStorageKey)
              : null,
          }
        : null,
    }));
  }

  private calculateDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((R * c + Number.EPSILON) * 100) / 100;
  }

  async getServiceById(serviceId: string): Promise<ServiceDetailSummary> {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: SERVICE_INCLUDE,
    });

    if (!service || !service.isActive || !service.vendor) {
      throw new NotFoundException('Service not found.');
    }

    if (service.vendor.status !== VendorStatus.VERIFIED && service.vendor.status !== VendorStatus.DRAFT && service.vendor.status !== VendorStatus.PENDING_REVIEW) {
      throw new BadRequestException('Vendor is not available for booking.');
    }

    const ratingSummary = await this.getServiceRatingSummary(service.id);

    const markupBps = await this.platformSettings.getServiceMarkupBps();
    const summary = this.mapServiceSummary(
      service,
      [
        {
          vendorId: service.vendor.id,
          _avg: { rating: ratingSummary.average ?? null },
          _count: { rating: ratingSummary.count ?? 0 },
        },
      ],
      markupBps,
    );

    const seats = await this.listSeatsForService(service.vendor.id, service.id);
    const recentReviews = await this.listServiceReviews(service.id, {
      take: 3,
    });

    return {
      ...summary,
      seats,
      ratingAverage: ratingSummary.average,
      ratingCount: ratingSummary.count,
      ratingHistogram: ratingSummary.histogram,
      recentReviews,
    };
  }

  async getServiceAvailability(
    serviceId: string,
    date?: string,
  ): Promise<ServiceAvailabilitySlot[]> {
    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        isActive: true,
        vendor: { status: { in: [VendorStatus.VERIFIED, VendorStatus.DRAFT, VendorStatus.PENDING_REVIEW] } },
      },
      select: { id: true, vendorId: true },
    });

    if (!service) {
      throw new NotFoundException('Service not found or inactive.');
    }

    const startDate = date ? new Date(date) : new Date();
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid start date.');
    }

    const slots = await this.servicesService.listAvailabilitySlotsByService(service.id, {
      startDate: startDate.toISOString().slice(0, 10),
      days: 1,
    });

    return slots.map((slot) => ({
      ...slot,
      seats: slot.seats.map((seat) => ({
        ...seat,
        staff: seat.staff
          ? {
              id: seat.staff.id,
              name: seat.staff.name,
              avatarUrl: seat.staff.avatarStorageKey
                ? this.storage.buildPublicUrl(seat.staff.avatarStorageKey)
                : null,
              bio: null,
            }
          : null,
      })),
    }));
  }

  async getServiceReviews(
    serviceId: string,
    query: ServiceReviewsQueryDto,
  ): Promise<ServiceReviewsResponse> {
    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        isActive: true,
        vendor: { status: { in: [VendorStatus.VERIFIED, VendorStatus.DRAFT, VendorStatus.PENDING_REVIEW] } },
      },
      select: { id: true },
    });

    if (!service) {
      throw new NotFoundException('Service not found or inactive.');
    }

    const ratingSummary = await this.getServiceRatingSummary(service.id);
    const take = Math.min(Math.max(query.limit ?? 10, 1), 50);
    const reviews = await this.listServiceReviews(service.id, {
      take: take + 1,
      cursor: query.cursor,
      rating: query.rating,
      withMedia: query.withMedia,
    });

    const hasNext = reviews.length > take;
    const sliced = hasNext ? reviews.slice(0, take) : reviews;

    return {
      reviews: sliced,
      nextCursor: hasNext ? reviews[take].id : null,
      rating: ratingSummary,
    };
  }

  async getVendorReviews(
    handle: string,
    query: ServiceReviewsQueryDto,
  ): Promise<ServiceReviewsResponse> {
    const normalizedHandle = this.normalizeHandle(handle);

    if (!normalizedHandle) {
      throw new NotFoundException('Vendor not found.');
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { handle: normalizedHandle },
      select: { id: true, status: true },
    });

    if (!vendor || vendor.status !== VendorStatus.VERIFIED) {
      throw new NotFoundException('Vendor not found.');
    }

    const ratingSummary = await this.getVendorRatingSummary(vendor.id);
    const take = Math.min(Math.max(query.limit ?? 10, 1), 50);
    const reviews = await this.listVendorReviews(vendor.id, {
      take: take + 1,
      cursor: query.cursor,
      rating: query.rating,
      withMedia: query.withMedia,
    });

    const hasNext = reviews.length > take;
    const sliced = hasNext ? reviews.slice(0, take) : reviews;

    return {
      reviews: sliced,
      nextCursor: hasNext ? reviews[take].id : null,
      rating: ratingSummary,
    };
  }

  private async getVendorRatingSummary(vendorId: string) {
    const histogram = [0, 0, 0, 0, 0];

    const grouped = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { vendorId },
      _count: { rating: true },
    });

    grouped.forEach((item) => {
      const index = item.rating - 1;
      if (index >= 0 && index < histogram.length) {
        histogram[index] = item._count.rating;
      }
    });

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { ratingAverage: true, ratingCount: true },
    });

    return {
      average: vendor?.ratingAverage ?? null,
      count: vendor?.ratingCount ?? 0,
      histogram,
    };
  }

  private async listVendorReviews(
    vendorId: string,
    options: {
      take: number;
      cursor?: string;
      rating?: number;
      withMedia?: boolean;
    },
  ): Promise<ServiceReview[]> {
    const reviews = await this.prisma.review.findMany({
      where: {
        vendorId,
        rating: options.rating ?? undefined,
        mediaStorageKeys: options.withMedia ? { isEmpty: false } : undefined,
      },
      include: {
        booking: {
          select: {
            scheduledStart: true,
            service: { select: { name: true } },
          },
        },
        customer: {
          select: {
            email: true,
            customerProfile: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options.take,
      cursor: options.cursor ? { id: options.cursor } : undefined,
      skip: options.cursor ? 1 : undefined,
    });

    return reviews.map((review) => {
      const fullName = review.customer.customerProfile?.fullName ?? null;
      const name =
        fullName && fullName.trim().length > 0 ? fullName : 'Customer';
      const initials = this.buildInitials(
        fullName ?? review.customer.email ?? 'C',
      );

      return {
        id: review.id,
        rating: review.rating,
        comment: review.comment ?? null,
        createdAt: review.createdAt.toISOString(),
        imageUrls: review.mediaStorageKeys.map((key) =>
          this.storage.buildPublicUrl(key),
        ),
        author: {
          name,
          initials,
        },
        vendorReply: review.reply
          ? {
              message: review.reply,
              repliedAt: review.repliedAt?.toISOString() ?? null,
            }
          : null,
      };
    });
  }

  private async getServiceRatingSummary(serviceId: string) {
    const histogram = [0, 0, 0, 0, 0];

    const grouped = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { booking: { serviceId } },
      _count: { rating: true },
    });

    grouped.forEach((item) => {
      const index = item.rating - 1;
      if (index >= 0 && index < histogram.length) {
        histogram[index] = item._count.rating;
      }
    });

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { ratingAverage: true, ratingCount: true },
    });

    return {
      average: service?.ratingAverage ?? null,
      count: service?.ratingCount ?? 0,
      histogram,
    };
  }

  async getServiceRecommendations(
    serviceId: string,
    options: {
      latitude?: number;
      longitude?: number;
      limit?: number;
    } = {},
  ): Promise<NearbyServiceSummary[]> {
    const limit = options.limit ?? 6;

    // Get the current service
    const currentService = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        categoryId: true,
        priceCents: true,
        vendor: {
          select: {
            id: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!currentService) {
      throw new NotFoundException('Service not found.');
    }

    // Build where clause for similar services
    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      id: { not: serviceId }, // Exclude current service
      vendor: {
        status: { in: [VendorStatus.VERIFIED, VendorStatus.DRAFT, VendorStatus.PENDING_REVIEW] },
      },
    };

    // Same category filter
    if (currentService.categoryId) {
      where.categoryId = currentService.categoryId;
    }

    const markupBps = await this.platformSettings.getServiceMarkupBps();

    // Fetch candidate services
    const services = await this.prisma.service.findMany({
      where,
      take: 50, // Get more than needed for scoring
      orderBy: [{ ratingAverage: 'desc' }, { createdAt: 'desc' }],
      include: SERVICE_INCLUDE,
    });

    const vendorIds = services
      .map((service) => service.vendor?.id)
      .filter((id): id is string => Boolean(id));

    const reviewAggregates =
      vendorIds.length === 0
        ? []
        : await this.prisma.review.groupBy({
            by: ['vendorId'],
            where: { vendorId: { in: vendorIds } },
            _avg: { rating: true },
            _count: { rating: true },
          });

    // Calculate scores for each service
    const scoredServices = services
      .filter((service) => service.vendor)
      .map((service) => {
        const vendor = service.vendor!;
        let score = 0;

        // Category match (40%)
        const categoryMatch = service.categoryId === currentService.categoryId ? 1 : 0;
        score += categoryMatch * 0.4;

        // Proximity score (30%) - if location provided
        let distanceKm = 0;
        if (
          options.latitude &&
          options.longitude &&
          vendor.latitude &&
          vendor.longitude
        ) {
          distanceKm = this.calculateDistanceKm(
            options.latitude,
            options.longitude,
            vendor.latitude,
            vendor.longitude,
          );
          const maxDistance = 50; // 50km max
          const proximityScore = Math.max(0, 1 - distanceKm / maxDistance);
          score += proximityScore * 0.3;
        } else {
          // If no location, use current service vendor location
          if (
            currentService.vendor.latitude &&
            currentService.vendor.longitude &&
            vendor.latitude &&
            vendor.longitude
          ) {
            distanceKm = this.calculateDistanceKm(
              currentService.vendor.latitude,
              currentService.vendor.longitude,
              vendor.latitude,
              vendor.longitude,
            );
            const maxDistance = 50;
            const proximityScore = Math.max(0, 1 - distanceKm / maxDistance);
            score += proximityScore * 0.3;
          }
        }

        // Rating score (20%)
        const ratingScore = (service.ratingAverage ?? 0) / 5;
        score += ratingScore * 0.2;

        // Price similarity (10%)
        const priceDiff = Math.abs(currentService.priceCents - service.priceCents);
        const priceRatio = priceDiff / currentService.priceCents;
        const priceScore = Math.max(0, 1 - Math.min(priceRatio, 0.3) / 0.3); // Cap at ±30%
        score += priceScore * 0.1;

        return {
          service,
          score,
          distanceKm,
        };
      })
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .slice(0, limit);

    return scoredServices.map(({ service, distanceKm }) => ({
      ...this.mapServiceSummary(service, reviewAggregates, markupBps),
      distanceKm,
    }));
  }


  private async listServiceReviews(
    serviceId: string,
    options: {
      take: number;
      cursor?: string;
      rating?: number;
      withMedia?: boolean;
    },
  ): Promise<ServiceReview[]> {
    const reviews = await this.prisma.review.findMany({
      where: {
        booking: { serviceId },
        rating: options.rating ?? undefined,
        mediaStorageKeys: options.withMedia ? { isEmpty: false } : undefined,
      },
      include: {
        booking: {
          select: {
            scheduledStart: true,
            service: { select: { name: true } },
          },
        },
        customer: {
          select: {
            email: true,
            customerProfile: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options.take,
      cursor: options.cursor ? { id: options.cursor } : undefined,
      skip: options.cursor ? 1 : undefined,
    });

    return reviews.map((review) => {
      const fullName = review.customer.customerProfile?.fullName ?? null;
      const name =
        fullName && fullName.trim().length > 0 ? fullName : 'Customer';
      const initials = this.buildInitials(
        fullName ?? review.customer.email ?? 'C',
      );

      return {
        id: review.id,
        rating: review.rating,
        comment: review.comment ?? null,
        createdAt: review.createdAt.toISOString(),
        imageUrls: review.mediaStorageKeys.map((key) =>
          this.storage.buildPublicUrl(key),
        ),
        author: {
          name,
          initials,
        },
        vendorReply: review.reply
          ? {
              message: review.reply,
              repliedAt: review.repliedAt?.toISOString() ?? null,
            }
          : null,
      };
    });
  }

  private buildInitials(source: string): string {
    const parts = source
      .split(' ')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    if (parts.length === 0) {
      return 'C';
    }

    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  private mapVendorSummaries(
    vendors: VendorSummarySource[],
    reviewAggregates: ReviewAggregate[],
    markupBps: number,
  ): VendorSummary[] {
    return vendors.map((vendor) =>
      this.mapVendorSummary(vendor, reviewAggregates, markupBps),
    );
  }

  private mapVendorSummary(
    vendor: VendorSummarySource,
    reviewAggregates: ReviewAggregate[],
    markupBps: number,
  ): VendorSummary {
    const summary = reviewAggregates.find(
      (aggregate) => aggregate.vendorId === vendor.id,
    );
    const startingPriceCents = vendor.services.length
      ? Math.min(
          ...vendor.services.map((service) =>
            this.applyMarkup(service.priceCents, markupBps),
          ),
        )
      : null;

    return {
      id: vendor.id,
      businessName: vendor.businessName,
      handle: vendor.handle,
      locationArea: vendor.locationArea ?? null,
      bio: vendor.bio ?? null,
      logoUrl: vendor.logoStorageKey
        ? this.storage.buildPublicUrl(
            vendor.logoStorageKey,
            vendor.logoVersion ?? null,
          )
        : null,
      ratingAverage: vendor.ratingAverage ?? null,
      ratingCount: vendor.ratingCount ?? 0,
      startingPriceCents,
      latitude: vendor.latitude ?? null,
      longitude: vendor.longitude ?? null,
      serviceRadiusKm: vendor.serviceRadiusKm ?? null,
      professionalTitle: vendor.professionalTitle ?? null,
      yearsExperience: vendor.yearsExperience ?? null,
      isVerified: vendor.status === VendorStatus.VERIFIED,
      instagramHandle: vendor.instagramHandle ?? null,
      tiktokHandle: vendor.tiktokHandle ?? null,
      facebookUrl: vendor.facebookUrl ?? null,
      xHandle: vendor.xHandle ?? null,
      youtubeChannel: vendor.youtubeChannel ?? null,
      bookingCount: vendor.bookingCount,
      travelsNationally: vendor.travelsNationally ?? false,
      travelFeePerKmPesewas: vendor.travelFeePerKmPesewas ?? null,
      paymentMode: vendor.paymentMode ?? 'FULL_UPFRONT',
      defaultDepositPercent: vendor.defaultDepositPercent ?? null,
    };
  }

  private applyMarkup(amount: number, basisPoints: number): number {
    const multiplier = 1 + basisPoints / 10000;
    const computed = Math.round(amount * multiplier);
    return computed > 0 ? computed : amount;
  }

  private normalizeHandle(handle: string): string {
    return handle.trim().replace(/^@+/, '').toLowerCase();
  }
}
