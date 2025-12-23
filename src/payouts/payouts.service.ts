import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayoutRequest,
  PayoutStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
  VendorPayoutMethod,
  WalletTransaction,
} from '@prisma/client';
import { PrismaService } from '../prisma';

@Injectable()
export class PayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async getWalletBalance(vendorId: string) {
    const now = new Date();

    // Sum all COMPLETED transactions
    const totalTransactions = await this.prisma.walletTransaction.aggregate({
      where: {
        vendorId,
        status: TransactionStatus.COMPLETED,
      },
      _sum: {
        amountPesewas: true,
      },
    });

    const lifetimeEarnings = await this.prisma.walletTransaction.aggregate({
      where: {
        vendorId,
        type: TransactionType.EARNING,
        status: TransactionStatus.COMPLETED,
      },
      _sum: {
        amountPesewas: true,
      },
    });

    const availableBalance = await this.prisma.walletTransaction.aggregate({
      where: {
        vendorId,
        status: TransactionStatus.COMPLETED,
        availableAt: { lte: now },
      },
      _sum: {
        amountPesewas: true,
      },
    });

    const pendingBalance = await this.prisma.walletTransaction.aggregate({
      where: {
        vendorId,
        status: TransactionStatus.COMPLETED,
        availableAt: { gt: now },
      },
      _sum: {
        amountPesewas: true,
      },
    });

    return {
      availableBalancePesewas: availableBalance._sum.amountPesewas ?? 0,
      pendingBalancePesewas: pendingBalance._sum.amountPesewas ?? 0,
      lifetimeEarningsPesewas: lifetimeEarnings._sum.amountPesewas ?? 0,
    };
  }

  async listTransactions(vendorId: string, take = 50, skip = 0) {
    return this.prisma.walletTransaction.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
  }

  async listPayoutRequests(vendorId: string, take = 50, skip = 0) {
    return this.prisma.payoutRequest.findMany({
      where: { vendorId },
      include: { destinationMethod: true },
      orderBy: { requestedAt: 'desc' },
      take,
      skip,
    });
  }

  async createPayoutRequest(
    userId: string,
    amountPesewas: number,
    payoutMethodId: string,
  ) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found.');
    }

    if (vendor.status !== 'VERIFIED') {
      throw new BadRequestException('Only verified vendors can request payouts.');
    }

    // Check balance
    const balance = await this.getWalletBalance(vendor.id);
    if (balance.availableBalancePesewas < amountPesewas) {
      throw new BadRequestException('Insufficient available balance.');
    }

    if (amountPesewas < 5000) {
      throw new BadRequestException('Minimum payout amount is GHS 50.00');
    }

    const payoutMethod = await this.prisma.vendorPayoutMethod.findFirst({
      where: { id: payoutMethodId, vendorId: vendor.id },
    });

    if (!payoutMethod) {
      throw new NotFoundException('Payout method not found.');
    }

    // Check for cooldown (48 hours after payout method update)
    const cooldownPeriod = 48 * 60 * 60 * 1000;
    if (
      payoutMethod.updatedAt.getTime() + cooldownPeriod >
      Date.now()
    ) {
      throw new BadRequestException(
        'Payouts are disabled for 48 hours after updating payout details for security.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Payout Request
      const request = await tx.payoutRequest.create({
        data: {
          vendorId: vendor.id,
          amountPesewas,
          payoutMethodId,
          status: PayoutStatus.REQUESTED,
        },
      });

      // 2. Create Transaction record (Debit)
      await tx.walletTransaction.create({
        data: {
          vendorId: vendor.id,
          amountPesewas: -amountPesewas,
          type: TransactionType.PAYOUT,
          status: TransactionStatus.COMPLETED,
          referenceId: request.id,
          description: `Payout to ${payoutMethod.accountName} (${
            payoutMethod.type === 'BANK_ACCOUNT'
              ? payoutMethod.bankName
              : payoutMethod.mobileNetwork
          })`,
          availableAt: new Date(),
        },
      });

      return request;
    });
  }

  async recordEarning(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { vendor: true },
    });

    if (!booking) return;

    // Calculate net earning (Price - Markup if any)
    // For now, let's assume pricePesewas is what vendor gets (minus platform fee if we implement it)
    const amountPesewas = booking.pricePesewas;

    // Clearance period: 1 day
    const availableAt = new Date();
    availableAt.setDate(availableAt.getDate() + 1);

    await this.prisma.walletTransaction.create({
      data: {
        vendorId: booking.vendorId,
        amountPesewas,
        type: TransactionType.EARNING,
        status: TransactionStatus.COMPLETED,
        referenceId: booking.id,
        description: `Earning from booking ${booking.reference}`,
        availableAt,
      },
    });
  }

  // Payout Method Management
  async addPayoutMethod(userId: string, dto: any) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    return this.prisma.vendorPayoutMethod.create({
      data: {
        ...dto,
        vendorId: vendor.id,
      },
    });
  }

  async listPayoutMethods(userId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    return this.prisma.vendorPayoutMethod.findMany({
      where: { vendorId: vendor.id },
      orderBy: { isPrimary: 'desc' },
    });
  }

  async deletePayoutMethod(userId: string, id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const method = await this.prisma.vendorPayoutMethod.findFirst({
      where: { id, vendorId: vendor.id },
    });

    if (!method) throw new NotFoundException('Payout method not found');

    return this.prisma.vendorPayoutMethod.delete({
      where: { id },
    });
  }
}
