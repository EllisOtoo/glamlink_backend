import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  RequestWithAuth,
} from '../auth/decorators/current-user.decorator';
import { CustomerProfilesService } from './customer-profiles.service';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { RequestProfilePhotoUploadDto } from './dto/request-profile-photo-upload.dto';
import { ConfirmProfilePhotoDto } from './dto/confirm-profile-photo.dto';

@Controller('customers/me/profile')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.VENDOR)
export class CustomerProfilesController {
  constructor(private readonly customerProfiles: CustomerProfilesService) {}

  @Get()
  getProfile(@CurrentUser() user: RequestWithAuth['auth']['user']) {
    return this.customerProfiles.getProfile(user.id);
  }

  @Patch()
  updateProfile(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    return this.customerProfiles.updateProfile(user.id, dto);
  }

  @Post('photo/upload-url')
  requestPhotoUploadUrl(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Body() dto: RequestProfilePhotoUploadDto,
  ) {
    return this.customerProfiles.requestProfilePhotoUploadUrl(user.id, dto);
  }

  @Put('photo')
  confirmPhotoUpload(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Body() dto: ConfirmProfilePhotoDto,
  ) {
    return this.customerProfiles.confirmProfilePhoto(user.id, dto.storageKey);
  }
}
