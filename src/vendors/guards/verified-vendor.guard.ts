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

    if (!vendor || vendor.status !== VendorStatus.VERIFIED) {
      throw new ForbiddenException(
        'Vendor account must be verified to access this resource.',
      );
    }

    return true;
  }
}
