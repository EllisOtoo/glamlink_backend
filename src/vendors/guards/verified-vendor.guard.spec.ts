import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { VendorStatus } from '@prisma/client';
import { VendorsService } from '../vendors.service';
import { VerifiedVendorGuard } from './verified-vendor.guard';

const mockContext = (userId: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        auth: {
          user: {
            id: userId,
          },
        },
      }),
    }),
  }) as unknown as ExecutionContext;

describe('VerifiedVendorGuard', () => {
  const findByUserIdMock = jest.fn();
  const vendorsService = {
    findByUserId: findByUserIdMock,
  } as unknown as VendorsService;

  const guard = new VerifiedVendorGuard(vendorsService);

  beforeEach(() => {
    findByUserIdMock.mockReset();
  });

  it('allows verified vendors', async () => {
    findByUserIdMock.mockResolvedValue({
      status: VendorStatus.VERIFIED,
    });

    await expect(guard.canActivate(mockContext('vendor-id'))).resolves.toBe(
      true,
    );
  });

  it('throws for missing vendor', async () => {
    findByUserIdMock.mockResolvedValue(null);

    await expect(
      guard.canActivate(mockContext('missing')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws for unverified vendor', async () => {
    findByUserIdMock.mockResolvedValue({
      status: VendorStatus.PENDING_REVIEW,
    });

    await expect(
      guard.canActivate(mockContext('pending')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
