import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { VendorStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';
import { StorageService } from '../storage/storage.service';
import { ServicesService } from '../services/services.service';
import type { DiscoverServicesQueryDto } from './dto/discover-services.dto';
import type { NearbyServicesQueryDto } from './dto/nearby-services.dto';

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
}

export interface ServiceImageSummary {
  id: string;
  imageUrl: string;
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
  createdAt: Date;
}

export interface NearbyServiceSummary extends ServiceSummary {
  distanceKm: number;
}

export interface SeatStaffSummary {
  id: string;
  name: string;
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
}

export interface VendorDetailSummary extends VendorSummary {
  services: ServiceSummary[];
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
  }[];
}

type ReviewAggregate = {
  vendorId: string;
  _avg: { rating: number | null };
  _count: { rating: number };
};

type VendorSummarySource = {
  id: string;
  businessName: string;
  handle: string;
  locationArea: string | null;
  bio: string | null;
  logoStorageKey: string | null;
  logoVersion: number | null;
  services: { priceCents: number }[];
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
  ) {}

  async highlightVendors(limit = 6): Promise<VendorSummary[]> {
    const vendors = await this.prisma.vendor.findMany({
      where: {
        status: VendorStatus.VERIFIED,
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
        logoStorageKey: true,
        logoVersion: true,
        latitude: true,
        longitude: true,
        serviceRadiusKm: true,
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

    return this.mapVendorSummaries(vendors, reviewAggregates);
  }

  async searchVendorsByHandle(
    handle: string,
    limit = 5,
  ): Promise<VendorSummary[]> {
    const normalizedHandle = this.normalizeHandle(handle);

    if (!normalizedHandle) {
      throw new BadRequestException('Handle is required to search vendors.');
    }

    const vendors = await this.prisma.vendor.findMany({
      where: {
        status: VendorStatus.VERIFIED,
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
        logoStorageKey: true,
        logoVersion: true,
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

    return this.mapVendorSummaries(vendors, reviewAggregates);
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
        services: {
          where: { isActive: true },
          select: { priceCents: true },
        },
      },
    });

    if (!vendor || vendor.status !== VendorStatus.VERIFIED) {
      throw new NotFoundException('Vendor not found.');
    }

    const reviewAggregate = await this.prisma.review.aggregate({
      where: { vendorId: vendor.id },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const services = await this.prisma.service.findMany({
      where: { vendorId: vendor.id, isActive: true },
      orderBy: [{ createdAt: 'desc' }],
      include: SERVICE_INCLUDE,
    });

    const reviewSummaries: ReviewAggregate[] = [
      {
        vendorId: vendor.id,
        _avg: { rating: reviewAggregate._avg.rating ?? null },
        _count: { rating: reviewAggregate._count.rating ?? 0 },
      },
    ];

    const vendorSummary = this.mapVendorSummary(vendor, reviewSummaries);
    const serviceSummaries = services.map((service) =>
      this.mapServiceSummary(service, reviewSummaries),
    );

    return {
      ...vendorSummary,
      services: serviceSummaries,
    };
  }

  async discoverServices(
    query: DiscoverServicesQueryDto,
  ): Promise<ServiceSummary[]> {
    const vendorWhere: Prisma.VendorWhereInput = {
      status: VendorStatus.VERIFIED,
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

    const limit = query.limit ?? 12;

    const services = await this.prisma.service.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
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
      .map((service) => this.mapServiceSummary(service, reviewAggregates));
  }

  async discoverNearbyServices(
    query: NearbyServicesQueryDto,
  ): Promise<NearbyServiceSummary[]> {
    const { latitude, longitude } = query;
    const radiusKm = query.radiusKm ?? 15;

    const services = await this.prisma.service.findMany({
      where: {
        isActive: true,
        vendor: {
          status: VendorStatus.VERIFIED,
          latitude: { not: null },
          longitude: { not: null },
        },
      },
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

    const withDistance = services
      .filter(
        (
          service,
        ): service is ServiceWithRelations & {
          vendor: ServiceWithRelations['vendor'] & {
            latitude: number;
            longitude: number;
          };
        } =>
          Boolean(
            service.vendor &&
              typeof service.vendor.latitude === 'number' &&
              typeof service.vendor.longitude === 'number',
          ),
      )
      .map((service) => {
        const vendor = service.vendor!;
        const distanceKm = this.calculateDistanceKm(
          latitude,
          longitude,
          vendor.latitude!,
          vendor.longitude!,
        );
        return { service, distanceKm };
      })
      .filter(({ service, distanceKm }) => {
        if (distanceKm > radiusKm) {
          return false;
        }
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
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 24);

    return withDistance.map(({ service, distanceKm }) => ({
      ...this.mapServiceSummary(service, reviewAggregates),
      distanceKm,
    }));
  }

  private mapServiceSummary(
    service: ServiceWithRelations,
    reviewAggregates: ReviewAggregate[],
  ): ServiceSummary {
    const vendor = service.vendor!;
    const vendorSummary = this.mapVendorSummary(vendor, reviewAggregates);

    return {
      id: service.id,
      name: service.name,
      description: service.description ?? null,
      priceCents: service.priceCents,
      durationMinutes: service.durationMinutes,
      createdAt: service.createdAt,
      vendor: vendorSummary,
      images: service.images.map((image) => ({
        id: image.id,
        caption: image.caption ?? null,
        imageUrl: this.storage.buildPublicUrl(
          image.storageKey,
          Math.floor(image.updatedAt.getTime() / 1000),
        ),
      })),
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

    if (service.vendor.status !== VendorStatus.VERIFIED) {
      throw new BadRequestException('Vendor is not available for booking.');
    }

    const reviewAggregate = await this.prisma.review.aggregate({
      where: { vendorId: service.vendor.id },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const summary = this.mapServiceSummary(service, [
      {
        vendorId: service.vendor.id,
        _avg: { rating: reviewAggregate._avg.rating ?? null },
        _count: { rating: reviewAggregate._count.rating ?? 0 },
      },
    ]);

    const seats = await this.listSeatsForService(service.vendor.id, service.id);

    return {
      ...summary,
      seats,
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
        vendor: { status: VendorStatus.VERIFIED },
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

    return this.servicesService.listAvailabilitySlotsByService(service.id, {
      startDate: startDate.toISOString().slice(0, 10),
      days: 1,
    });
  }

  private mapVendorSummaries(
    vendors: VendorSummarySource[],
    reviewAggregates: ReviewAggregate[],
  ): VendorSummary[] {
    return vendors.map((vendor) =>
      this.mapVendorSummary(vendor, reviewAggregates),
    );
  }

  private mapVendorSummary(
    vendor: VendorSummarySource,
    reviewAggregates: ReviewAggregate[],
  ): VendorSummary {
    const summary = reviewAggregates.find(
      (aggregate) => aggregate.vendorId === vendor.id,
    );
    const startingPriceCents = vendor.services.length
      ? Math.min(...vendor.services.map((service) => service.priceCents))
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
      ratingAverage: summary?._avg.rating ?? null,
      ratingCount: summary?._count.rating ?? 0,
      startingPriceCents,
    };
  }

  private normalizeHandle(handle: string): string {
    return handle.trim().replace(/^@+/, '').toLowerCase();
  }
}
