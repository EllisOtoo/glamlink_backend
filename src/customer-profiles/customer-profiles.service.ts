import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CustomerProfile, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma';
import { StorageService } from '../storage/storage.service';
import {
  normalizeMimeType,
  resolveImageExtension,
} from '../storage/media.helpers';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { RequestProfilePhotoUploadDto } from './dto/request-profile-photo-upload.dto';

const MAX_PROFILE_PHOTO_SIZE_BYTES = 3 * 1024 * 1024;

export interface CustomerProfilePublicView {
  fullName: string | null;
  phoneNumber: string | null;
  preferredPronouns: string | null;
  city: string | null;
  country: string | null;
  profilePhotoUrl: string | null;
  ageYears: number | null;
  is18OrAbove: boolean | null;
}

export interface CustomerProfileOwnerView extends CustomerProfilePublicView {
  dateOfBirth: string | null;
  marketingOptIn: boolean;
  smsOptIn: boolean;
  completion: {
    isComplete: boolean;
    missingFields: string[];
  };
}

@Injectable()
export class CustomerProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getProfile(userId: string): Promise<CustomerProfileOwnerView> {
    const profile = await this.findProfile(userId);
    return this.toOwnerView(profile);
  }

  async updateProfile(
    userId: string,
    dto: UpdateCustomerProfileDto,
  ): Promise<CustomerProfileOwnerView> {
    const fullName = this.normalizeNullable(dto.fullName);
    const phoneNumber = this.normalizeNullable(dto.phoneNumber);
    const preferredPronouns = this.normalizeNullable(dto.preferredPronouns);
    const city = this.normalizeNullable(dto.city);
    const country = this.normalizeNullable(dto.country);
    const dateOfBirth = this.parseDateOfBirth(dto.dateOfBirth);

    const updates: Prisma.CustomerProfileUpdateInput = {};
    if (fullName !== undefined) {
      updates.fullName = fullName;
    }
    if (phoneNumber !== undefined) {
      updates.phoneNumber = phoneNumber;
    }
    if (preferredPronouns !== undefined) {
      updates.preferredPronouns = preferredPronouns;
    }
    if (city !== undefined) {
      updates.city = city;
    }
    if (country !== undefined) {
      updates.country = country;
    }
    if (dateOfBirth !== undefined) {
      updates.dateOfBirth = dateOfBirth;
    }
    if (dto.marketingOptIn !== undefined) {
      updates.marketingOptIn = dto.marketingOptIn;
    }
    if (dto.smsOptIn !== undefined) {
      updates.smsOptIn = dto.smsOptIn;
    }

    const profile = await this.prisma.customerProfile.upsert({
      where: { userId },
      create: {
        userId,
        fullName: fullName ?? null,
        phoneNumber: phoneNumber ?? null,
        preferredPronouns: preferredPronouns ?? null,
        city: city ?? null,
        country: country ?? null,
        dateOfBirth: dateOfBirth ?? null,
        marketingOptIn: dto.marketingOptIn ?? false,
        smsOptIn: dto.smsOptIn ?? false,
      },
      update: updates,
    });

    return this.toOwnerView(profile);
  }

  async requestProfilePhotoUploadUrl(
    userId: string,
    dto: RequestProfilePhotoUploadDto,
  ) {
    await this.ensureUserExists(userId);
    const normalizedMime = normalizeMimeType(dto.mimeType);
    const extension = resolveImageExtension(normalizedMime);
    if (!extension) {
      throw new BadRequestException('Unsupported profile photo type.');
    }
    this.assertPhotoSize(dto.sizeBytes);

    const storageKey = `customers/${userId}/profile-photo/${randomUUID()}.${extension}`;
    return this.storage.createPresignedUpload({
      key: storageKey,
      contentType: normalizedMime,
      metadata: {
        userId,
        purpose: 'customer-profile-photo',
      },
    });
  }

  async confirmProfilePhoto(
    userId: string,
    storageKey: string,
  ): Promise<CustomerProfileOwnerView> {
    const normalizedKey = storageKey.trim();
    const expectedPrefix = `customers/${userId}/profile-photo/`;
    if (!normalizedKey.startsWith(expectedPrefix)) {
      throw new BadRequestException(
        'Profile photo does not belong to this user.',
      );
    }

    const profile = await this.prisma.customerProfile.upsert({
      where: { userId },
      create: {
        userId,
        profilePhotoStorageKey: normalizedKey,
        profilePhotoVersion: 1,
      },
      update: {
        profilePhotoStorageKey: normalizedKey,
        profilePhotoVersion: { increment: 1 },
      },
    });

    return this.toOwnerView(profile);
  }

  buildPublicProfile(
    profile: CustomerProfile | null,
  ): CustomerProfilePublicView {
    const ageYears = this.computeAge(profile?.dateOfBirth ?? null);
    return {
      fullName: profile?.fullName ?? null,
      phoneNumber: profile?.phoneNumber ?? null,
      preferredPronouns: profile?.preferredPronouns ?? null,
      city: profile?.city ?? null,
      country: profile?.country ?? null,
      profilePhotoUrl: this.buildPhotoUrl(profile),
      ageYears,
      is18OrAbove: ageYears === null ? null : ageYears >= 18,
    };
  }

  async findProfile(userId: string): Promise<CustomerProfile | null> {
    return this.prisma.customerProfile.findUnique({ where: { userId } });
  }

  private toOwnerView(
    profile: CustomerProfile | null,
  ): CustomerProfileOwnerView {
    const publicView = this.buildPublicProfile(profile);
    return {
      ...publicView,
      dateOfBirth: profile?.dateOfBirth?.toISOString() ?? null,
      marketingOptIn: profile?.marketingOptIn ?? false,
      smsOptIn: profile?.smsOptIn ?? false,
      completion: this.getCompletion(profile),
    };
  }

  private getCompletion(profile: CustomerProfile | null) {
    const missingFields: string[] = [];
    if (!profile?.fullName) {
      missingFields.push('fullName');
    }
    if (!profile?.phoneNumber) {
      missingFields.push('phoneNumber');
    }
    return {
      isComplete: missingFields.length === 0,
      missingFields,
    };
  }

  private normalizeNullable(value?: string | null): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private parseDateOfBirth(value?: string | null): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Provide dateOfBirth as a valid ISO date.');
    }

    const now = new Date();
    if (parsed.getTime() > now.getTime()) {
      throw new BadRequestException('Date of birth cannot be in the future.');
    }
    const oldest = new Date();
    oldest.setFullYear(oldest.getFullYear() - 120);
    if (parsed.getTime() < oldest.getTime()) {
      throw new BadRequestException('Date of birth seems invalid.');
    }

    return parsed;
  }

  private assertPhotoSize(sizeBytes?: number): void {
    if (
      typeof sizeBytes !== 'number' ||
      Number.isNaN(sizeBytes) ||
      sizeBytes <= 0
    ) {
      throw new BadRequestException('Profile photo file size is required.');
    }

    if (sizeBytes > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      throw new BadRequestException(
        'Profile photo exceeds the 3MB size limit.',
      );
    }
  }

  private buildPhotoUrl(profile: CustomerProfile | null): string | null {
    if (!profile?.profilePhotoStorageKey) {
      return null;
    }

    const version =
      typeof profile.profilePhotoVersion === 'number'
        ? profile.profilePhotoVersion
        : null;

    return this.storage.buildPublicUrl(profile.profilePhotoStorageKey, version);
  }

  private computeAge(dateOfBirth: Date | null): number | null {
    if (!dateOfBirth) {
      return null;
    }
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      return null;
    }

    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDelta = now.getMonth() - dob.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
      age -= 1;
    }

    if (age < 0 || age > 150) {
      return null;
    }

    return age;
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }
  }
}
