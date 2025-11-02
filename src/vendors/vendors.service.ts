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
} from '@prisma/client';
import { PrismaService } from '../prisma';

export interface VendorProfileResult extends Vendor {
  documents: KycDocument[];
  statusHistory: VendorStatusHistory[];
}

const REQUIRED_FIELDS_FOR_REVIEW: Array<keyof Vendor> = [
  'businessName',
  'handle',
  'contactEmail',
  'phoneNumber',
];

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

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
    },
  ): Promise<Vendor> {
    const normalizedHandle = payload.handle
      ? this.normalizeHandle(payload.handle)
      : undefined;

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
