import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  KycDocument,
  Prisma,
  Vendor,
  VendorStatus,
  VendorStatusHistory,
  StaffMember,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma';
import { StorageService } from '../storage/storage.service';
import {
  normalizeMimeType,
  resolveImageExtension,
} from '../storage/media.helpers';
import { MAX_VENDOR_LOGO_SIZE_BYTES } from './vendors.constants';
import type { RequestLogoUploadUrlDto } from './dto/request-logo-upload-url.dto';
import { RequestKycUploadUrlDto } from './dto/request-kyc-upload-url.dto';
import { CreateStaffMemberDto } from './dto/create-staff-member.dto';
import { UpdateStaffMemberDto } from './dto/update-staff-member.dto';
import { CreateSeatDto } from './dto/create-seat.dto';
import { UpdateSeatDto } from './dto/update-seat.dto';
import { MAX_KYC_DOCUMENT_SIZE_BYTES } from './vendors.constants';

export interface VendorProfileResult extends Vendor {
  documents: KycDocument[];
  statusHistory: VendorStatusHistory[];
}

type SeatWithRelations = Prisma.ServiceSeatGetPayload<{
  include: {
    staff: true;
    services: {
      include: {
        service: {
          select: {
            id: true;
            name: true;
            priceCents: true;
            durationMinutes: true;
            isActive: true;
          };
        };
      };
    };
  };
}>;

const REQUIRED_FIELDS_FOR_REVIEW: Array<keyof Vendor> = [
  'businessName',
  'handle',
  'contactEmail',
  'phoneNumber',
];

@Injectable()
export class VendorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async findByUserId(userId: string): Promise<Vendor | null> {
    return this.prisma.vendor.findUnique({
      where: { userId },
    });
  }

  async getProfile(userId: string): Promise<VendorProfileResult | null> {
    return this.prisma.vendor.findUnique({
      where: { userId },
      include: this.defaultProfileInclude(),
    });
  }

  async getProfileById(vendorId: string): Promise<VendorProfileResult> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: this.defaultProfileInclude(),
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found.');
    }

    return vendor;
  }

  async upsertProfile(
    userId: string,
    payload: {
      businessName?: string;
      handle?: string;
      contactEmail?: string;
      phoneNumber?: string;
      bio?: string;
      locationArea?: string;
      instagramHandle?: string;
      websiteUrl?: string;
      latitude?: number;
      longitude?: number;
      serviceRadiusKm?: number;
    },
  ): Promise<Vendor> {
    const normalizedHandle = payload.handle
      ? this.normalizeHandle(payload.handle)
      : undefined;

    console.log(payload, 'payload');

    if (!payload.businessName) {
      const existing = await this.findByUserId(userId);
      if (!existing) {
        throw new BadRequestException(
          'Business name is required when creating a vendor profile.',
        );
      }
    }

    if (normalizedHandle) {
      const handleTaken = await this.isHandleTaken(normalizedHandle, userId);
      if (handleTaken) {
        throw new BadRequestException('Handle is already in use.');
      }
    }

    const updateData: Prisma.VendorUpdateInput = {
      businessName: payload.businessName,
      handle: normalizedHandle,
      contactEmail: payload.contactEmail,
      phoneNumber: payload.phoneNumber,
      bio: payload.bio,
      locationArea: payload.locationArea,
      instagramHandle: payload.instagramHandle,
      websiteUrl: payload.websiteUrl,
      latitude:
        typeof payload.latitude === 'number' ? payload.latitude : undefined,
      longitude:
        typeof payload.longitude === 'number' ? payload.longitude : undefined,
      serviceRadiusKm:
        typeof payload.serviceRadiusKm === 'number'
          ? payload.serviceRadiusKm
          : undefined,
    };

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.vendor.findUnique({
        where: { userId },
      });

      if (!existing) {
        if (!payload.businessName || !normalizedHandle) {
          throw new BadRequestException(
            'Business name and handle are required to create a new vendor profile.',
          );
        }

        return tx.vendor.create({
          data: {
            userId,
            businessName: payload.businessName,
            handle: normalizedHandle,
            contactEmail: payload.contactEmail,
            phoneNumber: payload.phoneNumber,
            bio: payload.bio,
            locationArea: payload.locationArea,
            instagramHandle: payload.instagramHandle,
            websiteUrl: payload.websiteUrl,
            latitude:
              typeof payload.latitude === 'number'
                ? payload.latitude
                : undefined,
            longitude:
              typeof payload.longitude === 'number'
                ? payload.longitude
                : undefined,
            serviceRadiusKm:
              typeof payload.serviceRadiusKm === 'number'
                ? payload.serviceRadiusKm
                : undefined,
          },
        });
      }

      return tx.vendor.update({
        where: { id: existing.id },
        data: updateData,
      });
    });
  }

  async submitForReview(userId: string): Promise<Vendor> {
    return this.prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findUnique({
        where: { userId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor profile not found.');
      }

      if (
        vendor.status === VendorStatus.PENDING_REVIEW ||
        vendor.status === VendorStatus.VERIFIED
      ) {
        throw new BadRequestException(
          'Vendor profile is already under review or verified.',
        );
      }

      this.assertSubmissionReadiness(vendor);

      const documentCount = await tx.kycDocument.count({
        where: { vendorId: vendor.id },
      });

      if (documentCount === 0) {
        throw new BadRequestException(
          'Please upload at least one KYC document before submitting.',
        );
      }

      const updated = await tx.vendor.update({
        where: { id: vendor.id },
        data: {
          status: VendorStatus.PENDING_REVIEW,
          kycSubmittedAt: new Date(),
          rejectionReason: null,
        },
      });

      await this.recordStatusChange(tx, {
        vendorId: vendor.id,
        fromStatus: vendor.status,
        toStatus: VendorStatus.PENDING_REVIEW,
      });

      return updated;
    });
  }

  async addKycDocument(
    userId: string,
    payload: {
      type: string;
      fileName: string;
      storageKey: string;
      mimeType?: string;
      sizeBytes?: number;
    },
  ): Promise<KycDocument> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found.');
    }

    return this.prisma.kycDocument.create({
      data: {
        vendorId: vendor.id,
        type: payload.type,
        fileName: payload.fileName,
        storageKey: payload.storageKey,
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
      },
    });
  }

  async requestKycUploadUrl(userId: string, params: RequestKycUploadUrlDto) {
    const vendor = await this.requireVendor(userId);
    const { extension, normalizedMime } = this.assertKycConstraints(
      params.mimeType,
      params.sizeBytes,
    );
    const storageKey = `vendors/${vendor.id}/kyc/${randomUUID()}.${extension}`;
    return this.storage.createPresignedUpload({
      key: storageKey,
      contentType: normalizedMime,
      metadata: {
        vendorId: vendor.id,
        purpose: 'kyc',
        type: params.type ?? '',
      },
    });
  }

  async confirmKycUpload(
    userId: string,
    payload: {
      type: string;
      fileName: string;
      storageKey: string;
      mimeType?: string;
      sizeBytes?: number;
    },
  ): Promise<KycDocument> {
    const vendor = await this.requireVendor(userId);
    const normalizedKey = payload.storageKey.trim();
    const expectedPrefix = `vendors/${vendor.id}/kyc/`;
    if (!normalizedKey.startsWith(expectedPrefix)) {
      throw new BadRequestException(
        'KYC storage key does not belong to this vendor.',
      );
    }
    const { extension } = this.assertKycConstraints(
      payload.mimeType,
      payload.sizeBytes,
    );
    if (!payload.fileName.toLowerCase().includes('.')) {
      payload.fileName = `${payload.fileName}.${extension}`;
    }
    return this.prisma.kycDocument.create({
      data: {
        vendorId: vendor.id,
        type: payload.type,
        fileName: payload.fileName,
        storageKey: normalizedKey,
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
      },
    });
  }

  async listStaffMembers(userId: string): Promise<StaffMember[]> {
    const vendor = await this.requireVendor(userId);
    return this.prisma.staffMember.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createStaffMember(
    userId: string,
    payload: CreateStaffMemberDto,
  ): Promise<StaffMember> {
    const vendor = await this.requireVendor(userId);
    return this.prisma.staffMember.create({
      data: {
        vendorId: vendor.id,
        name: payload.name,
        bio: payload.bio,
        avatarStorageKey: payload.avatarStorageKey,
        specialties: payload.specialties ?? [],
        isActive: payload.isActive ?? true,
      },
    });
  }

  async updateStaffMember(
    userId: string,
    staffId: string,
    payload: UpdateStaffMemberDto,
  ): Promise<StaffMember> {
    const vendor = await this.requireVendor(userId);
    await this.ensureStaffBelongsToVendor(staffId, vendor.id);

    return this.prisma.staffMember.update({
      where: { id: staffId },
      data: {
        name: payload.name,
        bio: payload.bio,
        avatarStorageKey: payload.avatarStorageKey,
        specialties: payload.specialties,
        isActive: payload.isActive,
      },
    });
  }

  async archiveStaffMember(userId: string, staffId: string): Promise<void> {
    const vendor = await this.requireVendor(userId);
    await this.ensureStaffBelongsToVendor(staffId, vendor.id);
    await this.prisma.staffMember.update({
      where: { id: staffId },
      data: { isActive: false },
    });
  }

  async listSeats(userId: string): Promise<SeatWithRelations[]> {
    const vendor = await this.requireVendor(userId);
    return this.prisma.serviceSeat.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'asc' },
      include: this.defaultSeatInclude(),
    });
  }

  async createSeat(
    userId: string,
    payload: CreateSeatDto,
  ): Promise<SeatWithRelations> {
    const vendor = await this.requireVendor(userId);
    if (payload.staffId) {
      await this.ensureStaffBelongsToVendor(payload.staffId, vendor.id);
    }
    if (payload.serviceIds?.length) {
      await this.ensureServicesBelongToVendor(payload.serviceIds, vendor.id);
    }

    return this.prisma.serviceSeat.create({
      data: {
        vendorId: vendor.id,
        label: payload.label,
        description: payload.description,
        capacity: payload.capacity ?? 1,
        staffId: payload.staffId,
        isActive: payload.isActive ?? true,
        services: payload.serviceIds?.length
          ? {
              create: payload.serviceIds.map((serviceId) => ({ serviceId })),
            }
          : undefined,
      },
      include: this.defaultSeatInclude(),
    });
  }

  async updateSeat(
    userId: string,
    seatId: string,
    payload: UpdateSeatDto,
  ): Promise<SeatWithRelations> {
    const vendor = await this.requireVendor(userId);
    await this.ensureSeatBelongsToVendor(seatId, vendor.id);

    if (payload.staffId) {
      await this.ensureStaffBelongsToVendor(payload.staffId, vendor.id);
    }
    if (payload.serviceIds !== undefined) {
      if (payload.serviceIds.length) {
        await this.ensureServicesBelongToVendor(payload.serviceIds, vendor.id);
      }
    }

    const servicesRelation =
      payload.serviceIds !== undefined
        ? {
            deleteMany: {},
            ...(payload.serviceIds.length
              ? {
                  create: payload.serviceIds.map((serviceId) => ({
                    serviceId,
                  })),
                }
              : {}),
          }
        : undefined;

    return this.prisma.serviceSeat.update({
      where: { id: seatId },
      data: {
        label: payload.label,
        description: payload.description,
        capacity: payload.capacity,
        staffId: payload.staffId,
        isActive: payload.isActive,
        services: servicesRelation,
      },
      include: this.defaultSeatInclude(),
    });
  }

  async archiveSeat(userId: string, seatId: string): Promise<void> {
    const vendor = await this.requireVendor(userId);
    await this.ensureSeatBelongsToVendor(seatId, vendor.id);
    await this.prisma.serviceSeat.update({
      where: { id: seatId },
      data: { isActive: false },
    });
  }

  async adminApproveVendor(
    actorId: string,
    vendorId: string,
    note?: string,
  ): Promise<Vendor> {
    return this.prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findUnique({
        where: { id: vendorId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor profile not found.');
      }

      if (vendor.status !== VendorStatus.PENDING_REVIEW) {
        throw new BadRequestException(
          'Only vendors pending review can be approved.',
        );
      }

      const updated = await tx.vendor.update({
        where: { id: vendor.id },
        data: {
          status: VendorStatus.VERIFIED,
          verifiedAt: new Date(),
          reviewedById: actorId,
          rejectionReason: null,
        },
      });

      await this.recordStatusChange(tx, {
        vendorId: vendor.id,
        fromStatus: vendor.status,
        toStatus: VendorStatus.VERIFIED,
        reason: note,
        actorId,
      });

      return updated;
    });
  }

  async adminRejectVendor(
    actorId: string,
    vendorId: string,
    reason: string,
  ): Promise<Vendor> {
    return this.prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findUnique({
        where: { id: vendorId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor profile not found.');
      }

      if (vendor.status !== VendorStatus.PENDING_REVIEW) {
        throw new BadRequestException(
          'Only vendors pending review can be rejected.',
        );
      }

      const updated = await tx.vendor.update({
        where: { id: vendor.id },
        data: {
          status: VendorStatus.REJECTED,
          rejectionReason: reason,
          reviewedById: actorId,
        },
      });

      await this.recordStatusChange(tx, {
        vendorId: vendor.id,
        fromStatus: vendor.status,
        toStatus: VendorStatus.REJECTED,
        reason,
        actorId,
      });

      return updated;
    });
  }

  private async recordStatusChange(
    tx: Prisma.TransactionClient,
    params: {
      vendorId: string;
      fromStatus?: VendorStatus | null;
      toStatus: VendorStatus;
      reason?: string;
      actorId?: string;
    },
  ): Promise<void> {
    await tx.vendorStatusHistory.create({
      data: {
        vendorId: params.vendorId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        reason: params.reason,
        actorId: params.actorId,
      },
    });
  }

  private assertSubmissionReadiness(vendor: Vendor): void {
    for (const field of REQUIRED_FIELDS_FOR_REVIEW) {
      const value = vendor[field];
      if (value === null || value === undefined) {
        throw new BadRequestException(
          `Vendor profile missing required field: ${field}`,
        );
      }

      if (typeof value === 'string' && value.trim().length === 0) {
        throw new BadRequestException(
          `Vendor profile missing required field: ${field}`,
        );
      }
    }
  }

  private async isHandleTaken(
    handle: string,
    userId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.vendor.findFirst({
      where: {
        handle,
        NOT: {
          userId,
        },
      },
    });

    return Boolean(existing);
  }

  private normalizeHandle(handle: string): string {
    return handle.trim().toLowerCase();
  }

  async requestLogoUploadUrl(userId: string, params: RequestLogoUploadUrlDto) {
    const vendor = await this.requireVendor(userId);
    this.assertLogoConstraints(params.mimeType, params.sizeBytes);
    const extension = resolveImageExtension(params.mimeType);
    if (!extension) {
      throw new BadRequestException('Unsupported image type for vendor logo.');
    }
    const storageKey = `vendors/${vendor.id}/logo/${randomUUID()}.${extension}`;
    return this.storage.createPresignedUpload({
      key: storageKey,
      contentType: normalizeMimeType(params.mimeType),
      metadata: {
        vendorId: vendor.id,
        purpose: 'logo',
      },
    });
  }

  async confirmLogoUpload(userId: string, storageKey: string): Promise<Vendor> {
    const vendor = await this.requireVendor(userId);
    const normalizedKey = storageKey.trim();
    const expectedPrefix = `vendors/${vendor.id}/logo/`;
    if (!normalizedKey.startsWith(expectedPrefix)) {
      throw new BadRequestException(
        'Logo storage key does not belong to this vendor.',
      );
    }

    return this.prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        logoStorageKey: normalizedKey,
        logoVersion: { increment: 1 },
      },
    });
  }

  private async requireVendor(userId: string): Promise<Vendor> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found.');
    }

    return vendor;
  }

  private async ensureStaffBelongsToVendor(staffId: string, vendorId: string) {
    if (!staffId) {
      return;
    }
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffId, vendorId },
    });
    if (!staff) {
      throw new NotFoundException('Staff member not found for this vendor.');
    }
  }

  private async ensureSeatBelongsToVendor(seatId: string, vendorId: string) {
    const seat = await this.prisma.serviceSeat.findFirst({
      where: { id: seatId, vendorId },
    });
    if (!seat) {
      throw new NotFoundException('Seat not found for this vendor.');
    }
  }

  private async ensureServicesBelongToVendor(
    serviceIds: string[],
    vendorId: string,
  ) {
    if (!serviceIds.length) {
      return;
    }
    const count = await this.prisma.service.count({
      where: {
        vendorId,
        id: { in: serviceIds },
      },
    });

    if (count !== serviceIds.length) {
      throw new BadRequestException(
        'One or more services are invalid for this vendor.',
      );
    }
  }

  private defaultSeatInclude() {
    return {
      staff: true,
      services: {
        include: {
          service: {
            select: {
              id: true,
              name: true,
              priceCents: true,
              durationMinutes: true,
              isActive: true,
            },
          },
        },
      },
    } satisfies Prisma.ServiceSeatInclude;
  }

  private assertLogoConstraints(mimeType?: string, sizeBytes?: number): void {
    const normalizedMime = normalizeMimeType(mimeType);
    if (!normalizedMime) {
      throw new BadRequestException('Logo mime type is required.');
    }

    if (
      typeof sizeBytes !== 'number' ||
      Number.isNaN(sizeBytes) ||
      sizeBytes <= 0
    ) {
      throw new BadRequestException('Logo file size is required.');
    }

    if (sizeBytes > MAX_VENDOR_LOGO_SIZE_BYTES) {
      throw new BadRequestException(
        'Logo file exceeds the maximum size of 2MB.',
      );
    }

    if (!resolveImageExtension(normalizedMime)) {
      throw new BadRequestException('Unsupported logo image type.');
    }
  }

  private assertKycConstraints(
    mimeType?: string,
    sizeBytes?: number,
  ): { extension: string; normalizedMime: string } {
    const normalizedMime = normalizeMimeType(mimeType);
    if (!normalizedMime) {
      throw new BadRequestException('KYC document mime type is required.');
    }

    if (
      typeof sizeBytes !== 'number' ||
      Number.isNaN(sizeBytes) ||
      sizeBytes <= 0
    ) {
      throw new BadRequestException('KYC document file size is required.');
    }

    if (sizeBytes > MAX_KYC_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException(
        'KYC document exceeds the maximum size of 10MB.',
      );
    }

    const extension = this.resolveKycExtension(normalizedMime);
    if (!extension) {
      throw new BadRequestException('Unsupported KYC document type.');
    }

    return { extension, normalizedMime };
  }

  private resolveKycExtension(mimeType: string): string | null {
    const normalized = normalizeMimeType(mimeType);
    if (resolveImageExtension(normalized)) {
      return resolveImageExtension(normalized);
    }
    if (normalized === 'application/pdf') {
      return 'pdf';
    }
    return null;
  }

  private defaultProfileInclude() {
    return {
      documents: {
        orderBy: { uploadedAt: 'desc' },
      },
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    } satisfies Prisma.VendorInclude;
  }
}
