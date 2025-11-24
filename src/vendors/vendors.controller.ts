import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { VendorStatus, UserRole } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { VendorsService, VendorProfileResult } from './vendors.service';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import { CreateKycDocumentDto } from './dto/create-kyc-document.dto';
import { AdminRejectDto, AdminReviewDto } from './dto/admin-review.dto';
import { VerifiedVendorGuard } from './guards/verified-vendor.guard';
import { RequestLogoUploadUrlDto } from './dto/request-logo-upload-url.dto';
import { ConfirmLogoDto } from './dto/confirm-logo.dto';
import { StorageService } from '../storage/storage.service';
import { CreateStaffMemberDto } from './dto/create-staff-member.dto';
import { UpdateStaffMemberDto } from './dto/update-staff-member.dto';
import { CreateSeatDto } from './dto/create-seat.dto';
import { UpdateSeatDto } from './dto/update-seat.dto';
import { RequestKycUploadUrlDto } from './dto/request-kyc-upload-url.dto';

@Controller()
export class VendorsController {
  constructor(
    private readonly vendorsService: VendorsService,
    private readonly storage: StorageService,
  ) {}

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendors/me')
  async getMyProfile(
    @CurrentUser() user: User,
  ): Promise<VendorProfileResult | null> {
    const profile = await this.vendorsService.getProfile(user.id);
    return this.withLogoUrl(profile);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Put('vendors/me')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateVendorProfileDto,
  ) {
    const profile = await this.vendorsService.upsertProfile(user.id, dto);
    return this.withLogoUrl(profile);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendors/me/logo/upload-url')
  requestLogoUpload(
    @CurrentUser() user: User,
    @Body() dto: RequestLogoUploadUrlDto,
  ) {
    return this.vendorsService.requestLogoUploadUrl(user.id, dto);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Put('vendors/me/logo')
  async confirmLogoUpload(
    @CurrentUser() user: User,
    @Body() dto: ConfirmLogoDto,
  ) {
    const vendor = await this.vendorsService.confirmLogoUpload(
      user.id,
      dto.storageKey,
    );
    return this.withLogoUrl(vendor);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendors/me/submit')
  async submitForReview(@CurrentUser() user: User) {
    return this.vendorsService.submitForReview(user.id);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendors/me/documents')
  async addDocument(
    @CurrentUser() user: User,
    @Body() dto: CreateKycDocumentDto,
  ) {
    return this.vendorsService.confirmKycUpload(user.id, dto);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendors/me/documents/upload-url')
  requestKycUpload(
    @CurrentUser() user: User,
    @Body() dto: RequestKycUploadUrlDto,
  ) {
    return this.vendorsService.requestKycUploadUrl(user.id, dto);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendors/me/staff')
  listStaff(@CurrentUser() user: User) {
    return this.vendorsService.listStaffMembers(user.id);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendors/me/staff')
  createStaff(
    @CurrentUser() user: User,
    @Body() dto: CreateStaffMemberDto,
  ) {
    return this.vendorsService.createStaffMember(user.id, dto);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Put('vendors/me/staff/:staffId')
  updateStaff(
    @CurrentUser() user: User,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffMemberDto,
  ) {
    return this.vendorsService.updateStaffMember(user.id, staffId, dto);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Delete('vendors/me/staff/:staffId')
  async archiveStaff(
    @CurrentUser() user: User,
    @Param('staffId') staffId: string,
  ) {
    await this.vendorsService.archiveStaffMember(user.id, staffId);
    return { status: 'ok' };
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendors/me/seats')
  listSeats(@CurrentUser() user: User) {
    return this.vendorsService.listSeats(user.id);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendors/me/seats')
  createSeat(@CurrentUser() user: User, @Body() dto: CreateSeatDto) {
    return this.vendorsService.createSeat(user.id, dto);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Put('vendors/me/seats/:seatId')
  updateSeat(
    @CurrentUser() user: User,
    @Param('seatId') seatId: string,
    @Body() dto: UpdateSeatDto,
  ) {
    return this.vendorsService.updateSeat(user.id, seatId, dto);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Delete('vendors/me/seats/:seatId')
  async archiveSeat(
    @CurrentUser() user: User,
    @Param('seatId') seatId: string,
  ) {
    await this.vendorsService.archiveSeat(user.id, seatId);
    return { status: 'ok' };
  }

  @UseGuards(SessionAuthGuard, RolesGuard, VerifiedVendorGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendors/me/verified-check')
  verifiedCheck() {
    return { status: VendorStatus.VERIFIED };
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/vendors/:vendorId')
  async getVendorById(
    @Param('vendorId') vendorId: string,
  ): Promise<VendorProfileResult> {
    const vendor = await this.vendorsService.getProfileById(vendorId);
    return this.withLogoUrl(vendor) as VendorProfileResult;
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/vendors/:vendorId/approve')
  async approveVendor(
    @CurrentUser() user: User,
    @Param('vendorId') vendorId: string,
    @Body() dto: AdminReviewDto,
  ) {
    const vendor = await this.vendorsService.adminApproveVendor(
      user.id,
      vendorId,
      dto.note,
    );
    return this.withLogoUrl(vendor);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/vendors/:vendorId/reject')
  async rejectVendor(
    @CurrentUser() user: User,
    @Param('vendorId') vendorId: string,
    @Body() dto: AdminRejectDto,
  ) {
    const vendor = await this.vendorsService.adminRejectVendor(
      user.id,
      vendorId,
      dto.reason,
    );
    return this.withLogoUrl(vendor);
  }

  private withLogoUrl<T extends { logoStorageKey: string | null; logoVersion?: number | null }>(
    vendor: T | null,
  ): (T & { logoUrl: string | null }) | null {
    if (!vendor) {
      return null;
    }

    const logoUrl =
      vendor.logoStorageKey && vendor.logoStorageKey.length > 0
        ? this.storage.buildPublicUrl(
            vendor.logoStorageKey,
            vendor.logoVersion ?? null,
          )
        : null;

    return {
      ...vendor,
      logoUrl,
    };
  }
}
