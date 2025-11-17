import { Injectable } from '@nestjs/common';
import { VendorStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';
import { StorageService } from '../storage/storage.service';
import type { DiscoverServicesQueryDto } from './dto/discover-services.dto';
import type { NearbyServicesQueryDto } from './dto/nearby-services.dto';
import type { Prisma as PrismaClient } from '@prisma/client';

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

type ReviewAggregate = {
  vendorId: string;
  _avg: { rating: number | null };
  _count: { rating: number };
};

const SERVICE_INCLUDE = {
  vendor: {
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
  ) {}

  async highlightVendors(limit = 6): Promise<VendorSummary[]> {
    const vendors = await this.prisma.vendor.findMany({
      where: {
        status: VendorStatus.VERIFIED,
        services: {
          some: { isActive: true },
        },
      },
      orderBy: [
        { verifiedAt: 'desc' },
        { createdAt: 'desc' },
      ],
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

    return vendors.map((vendor) => {
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
    });
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
        (service): service is ServiceWithRelations & {
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
    const vendorReviewSummary = reviewAggregates.find(
      (aggregate) => aggregate.vendorId === vendor.id,
    );
    const startingPriceCents = vendor.services.length
      ? Math.min(...vendor.services.map((entry) => entry.priceCents))
      : null;

    return {
      id: service.id,
      name: service.name,
      description: service.description ?? null,
      priceCents: service.priceCents,
      durationMinutes: service.durationMinutes,
      createdAt: service.createdAt,
      vendor: {
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
        ratingAverage: vendorReviewSummary?._avg.rating ?? null,
        ratingCount: vendorReviewSummary?._count.rating ?? 0,
        startingPriceCents,
      },
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
}
