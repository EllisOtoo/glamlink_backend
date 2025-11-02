import {
  Body,
  Controller,
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

@Controller()
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendors/me')
  async getMyProfile(
    @CurrentUser() user: User,
  ): Promise<VendorProfileResult | null> {
    return this.vendorsService.getProfile(user.id);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Put('vendors/me')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateVendorProfileDto,
  ) {
    return this.vendorsService.upsertProfile(user.id, dto);
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
    return this.vendorsService.addKycDocument(user.id, dto);
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
    return this.vendorsService.getProfileById(vendorId);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/vendors/:vendorId/approve')
  async approveVendor(
    @CurrentUser() user: User,
    @Param('vendorId') vendorId: string,
    @Body() dto: AdminReviewDto,
  ) {
    return this.vendorsService.adminApproveVendor(user.id, vendorId, dto.note);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/vendors/:vendorId/reject')
  async rejectVendor(
    @CurrentUser() user: User,
    @Param('vendorId') vendorId: string,
    @Body() dto: AdminRejectDto,
  ) {
    return this.vendorsService.adminRejectVendor(user.id, vendorId, dto.reason);
  }
}
