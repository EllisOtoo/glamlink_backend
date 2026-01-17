import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import type { User } from '@prisma/client';
import { BookingStatus, UserRole } from '@prisma/client';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import {
  normalizeMimeType,
  resolveImageExtension,
} from '../storage/media.helpers';
import { randomUUID } from 'crypto';
import {
  MAX_REVIEW_MEDIA_PER_REVIEW,
  MAX_REVIEW_MEDIA_SIZE_BYTES,
} from './reviews.constants';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  async createReview(user: User, bookingId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vendor: true,
        review: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (booking.customerUserId !== user.id) {
      throw new ForbiddenException('Only the booking owner can review.');
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('You can only review completed bookings.');
    }

    if (!booking.vendor.userId) {
      throw new BadRequestException('Vendor account is not fully configured.');
    }

    if (booking.review) {
      throw new BadRequestException(
        'A review already exists for this booking.',
      );
    }

    if (
      dto.mediaStorageKeys &&
      dto.mediaStorageKeys.length > MAX_REVIEW_MEDIA_PER_REVIEW
    ) {
      throw new BadRequestException(
        `You can attach up to ${MAX_REVIEW_MEDIA_PER_REVIEW} photos per review.`,
      );
    }

    const trimmedComment =
      dto.comment && dto.comment.trim().length > 0 ? dto.comment.trim() : null;
    const mediaStorageKeys =
      dto.mediaStorageKeys && dto.mediaStorageKeys.length > 0
        ? dto.mediaStorageKeys
        : [];

    const review = await this.prisma.review.create({
      data: {
        bookingId: booking.id,
        vendorId: booking.vendorId,
        customerUserId: user.id,
        rating: dto.rating,
        comment: trimmedComment,
        mediaStorageKeys,
      },
      include: {
        vendor: { select: { businessName: true, userId: true } },
        booking: {
          select: { service: { select: { name: true } }, scheduledStart: true },
        },
      },
    });

    await this.notifications.notifyReviewSubmitted({
      reviewId: review.id,
      vendorUserId: booking.vendor.userId,
      serviceName: review.booking.service.name,
      rating: review.rating,
    });

    // Update denormalized rating metrics
    await this.prisma.$transaction(async (tx) => {
      await this.recalculateRatingMetrics(
        tx,
        'service',
        booking.serviceId,
        dto.rating,
      );
      await this.recalculateRatingMetrics(
        tx,
        'vendor',
        booking.vendorId,
        dto.rating,
      );
    });

    return review;
  }

  async replyToReview(user: User, reviewId: string, dto: ReplyReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        vendor: { select: { userId: true, businessName: true } },
        booking: {
          select: {
            customerUserId: true,
            service: { select: { name: true } },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found.');
    }

    if (user.role !== UserRole.VENDOR || review.vendor.userId !== user.id) {
      throw new ForbiddenException('Only the vendor can reply to this review.');
    }

    if (review.reply) {
      throw new BadRequestException('This review already has a reply.');
    }

    const reply =
      dto.reply && dto.reply.trim().length > 0 ? dto.reply.trim() : null;

    const updated = await this.prisma.review.update({
      where: { id: review.id },
      data: {
        reply,
        repliedAt: new Date(),
      },
    });

    if (review.booking.customerUserId) {
      await this.notifications.notifyReviewReplied({
        reviewId: review.id,
        customerUserId: review.booking.customerUserId,
        serviceName: review.booking.service.name,
      });
    }

    return updated;
  }

  async listVendorReviews(
    user: User,
    params: { pendingOnly?: boolean; take?: number },
  ) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { userId: user.id },
    });

    if (!vendor) {
      throw new BadRequestException('Vendor profile not found.');
    }

    const limit = Math.min(Math.max(params.take ?? 5, 1), 50);

    return this.prisma.review.findMany({
      where: {
        vendorId: vendor.id,
        reply: params.pendingOnly ? null : undefined,
      },
      include: {
        booking: {
          select: {
            id: true,
            scheduledStart: true,
            service: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async requestReviewMediaUpload(
    user: User,
    bookingId: string,
    params: { mimeType: string; sizeBytes: number },
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vendor: true,
        review: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (booking.customerUserId !== user.id) {
      throw new ForbiddenException('Only the booking owner can upload media.');
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException(
        'You can only add photos for completed bookings.',
      );
    }

    if (booking.review) {
      throw new BadRequestException(
        'A review already exists for this booking.',
      );
    }

    this.assertMediaConstraints(params.mimeType, params.sizeBytes);
    const extension = resolveImageExtension(params.mimeType);
    if (!extension) {
      throw new BadRequestException('Unsupported image type for reviews.');
    }

    const storageKey = `reviews/${booking.id}/${randomUUID()}.${extension}`;
    return this.storage.createPresignedUpload({
      key: storageKey,
      contentType: normalizeMimeType(params.mimeType),
      metadata: {
        bookingId: booking.id,
        vendorId: booking.vendorId,
        customerUserId: user.id,
        purpose: 'review_media',
      },
    });
  }

  private assertMediaConstraints(mimeType: string, sizeBytes: number) {
    const normalizedMime = normalizeMimeType(mimeType);
    if (!resolveImageExtension(normalizedMime)) {
      throw new BadRequestException('Only image uploads are supported.');
    }

    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      throw new BadRequestException('File size must be greater than zero.');
    }

    if (sizeBytes > MAX_REVIEW_MEDIA_SIZE_BYTES) {
      throw new BadRequestException(
        `Each photo must be ${Math.floor(
          MAX_REVIEW_MEDIA_SIZE_BYTES / (1024 * 1024),
        )}MB or smaller.`,
      );
    }
  }

  private async recalculateRatingMetrics(
    tx: any, // Using any here to allow dynamic access to tx[entityType]
    entityType: 'service' | 'vendor',
    entityId: string,
    newRating: number,
  ) {
    const entity = await tx[entityType].findUnique({
      where: { id: entityId },
      select: { ratingAverage: true, ratingCount: true },
    });

    if (!entity) return;

    const oldCount = entity.ratingCount || 0;
    const oldAverage = entity.ratingAverage || 0;
    const newCount = oldCount + 1;
    const newAverage = (oldAverage * oldCount + newRating) / newCount;

    await tx[entityType].update({
      where: { id: entityId },
      data: {
        ratingAverage: newAverage,
        ratingCount: newCount,
      },
    });
  }
}
