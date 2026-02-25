import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { VendorStatus } from '@prisma/client';
import { RequestWithAuth } from '../../auth/decorators/current-user.decorator';
import { VendorsService } from '../vendors.service';

@Injectable()
export class VerifiedVendorGuard implements CanActivate {
  constructor(private readonly vendorsService: VendorsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithAuth | undefined>();

    const user = request?.auth?.user;
    if (!user) {
      return false;
    }

    const vendor = await this.vendorsService.findByUserId(user.id);

    // No vendor profile yet — allow access so onboarding can create services before submitting.
    // The individual service operations guard against missing profiles internally.
    if (!vendor) {
      return true;
    }

    // Block REJECTED vendors (and any future statuses not explicitly allowed)
    if (
      vendor.status !== VendorStatus.VERIFIED &&
      vendor.status !== VendorStatus.DRAFT &&
      vendor.status !== VendorStatus.PENDING_REVIEW
    ) {
      throw new ForbiddenException(
        'Vendor account must be verified to access this resource.',
      );
    }

    return true;
  }
}
