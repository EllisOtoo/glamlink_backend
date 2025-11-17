import { Injectable } from '@nestjs/common';
import { VendorStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';
import { StorageService } from '../storage/storage.service';
import type { DiscoverServicesQueryDto } from './dto/discover-services.dto';

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
      include: {
        vendor: {
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
      },
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
      .map((service) => {
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
      });
  }
}
