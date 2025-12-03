import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GiftCard,
  GiftCardStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  VendorStatus,
} from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma';
import { PaystackService, PaystackCheckoutPayload } from '../payments/paystack.service';
import { CreateGiftCardDto } from './dto/create-gift-card.dto';

export interface GiftCardApplicationResult {
  remainingDeposit: number;
  remainingBalance: number;
  appliedDeposit: number;
  appliedBalance: number;
  giftCardId: string;
}

export interface GiftCardSummary {
  id: string;
  code: string;
  status: GiftCardStatus;
  balancePesewas: number;
  valuePesewas: number;
  currency: string;
  vendorId: string;
  vendorName: string;
  expiresAt: Date | null;
  activatedAt: Date | null;
}

const MIN_GIFT_CARD_AMOUNT = 1000;

@Injectable()
export class GiftCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
  ) {}

  async createGiftCardPurchase(
    dto: CreateGiftCardDto,
  ): Promise<{ giftCard: GiftCard; paystack: PaystackCheckoutPayload }> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: dto.vendorId },
      select: {
        id: true,
        status: true,
        businessName: true,
        contactEmail: true,
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found.');
    }

    if (vendor.status !== VendorStatus.VERIFIED) {
      throw new BadRequestException('Vendor must be verified to issue gift cards.');
    }

    const amount = this.assertAmount(dto.amountPesewas);
    const currency = (dto.currency ?? 'GHS').toUpperCase();
    const code = await this.generateUniqueCode();
    const reference = `gft_${randomUUID().replace(/-/g, '').slice(0, 28)}`;

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid expiry date.');
    }
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Expiry must be in the future.');
    }

    const giftCard = await this.prisma.giftCard.create({
      data: {
        code,
        vendorId: vendor.id,
        valuePesewas: amount,
        balancePesewas: amount,
        currency,
        purchaserName: dto.purchaserName.trim(),
        purchaserEmail: dto.purchaserEmail.toLowerCase(),
        purchaserPhone: dto.purchaserPhone?.trim() ?? null,
        recipientName: dto.recipientName?.trim() ?? null,
        recipientEmail: dto.recipientEmail?.toLowerCase() ?? null,
        message: dto.message?.trim() ?? null,
        expiresAt,
        status: GiftCardStatus.PENDING_PAYMENT,
      },
    });

    await this.prisma.paymentIntent.create({
      data: {
        giftCardId: giftCard.id,
        provider: PaymentProvider.PAYSTACK,
        providerRef: reference,
        amountPesewas: amount,
        status: PaymentStatus.REQUIRES_PAYMENT_METHOD,
        currency,
        metadata: {
          type: 'GIFT_CARD',
          giftCardId: giftCard.id,
          vendorId: vendor.id,
          purchaserEmail: giftCard.purchaserEmail,
        } as Prisma.InputJsonValue,
      },
    });

    const paystackPayload = this.buildGiftCardCheckoutPayload({
      reference,
      amount,
      currency,
      purchaserEmail: giftCard.purchaserEmail,
      giftCardId: giftCard.id,
      vendorId: vendor.id,
    });

    return { giftCard, paystack: paystackPayload };
  }

  async getGiftCardForPublic(
    code: string,
    email: string,
  ): Promise<GiftCardSummary> {
    const normalizedCode = this.normalizeCode(code);
    const normalizedEmail = email.toLowerCase();
    const giftCard = await this.prisma.giftCard.findUnique({
      where: { code: normalizedCode },
      include: {
        vendor: { select: { businessName: true } },
      },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found.');
    }

    if (
      giftCard.purchaserEmail?.toLowerCase() !== normalizedEmail &&
      giftCard.recipientEmail?.toLowerCase() !== normalizedEmail
    ) {
      throw new BadRequestException('Email does not match this gift card.');
    }

    if (this.isExpired(giftCard.expiresAt)) {
      await this.prisma.giftCard.update({
        where: { id: giftCard.id },
        data: { status: GiftCardStatus.EXPIRED },
      });
      throw new BadRequestException('Gift card has expired.');
    }

    return {
      id: giftCard.id,
      code: giftCard.code,
      status: giftCard.status,
      balancePesewas: giftCard.balancePesewas,
      valuePesewas: giftCard.valuePesewas,
      currency: giftCard.currency,
      vendorId: giftCard.vendorId,
      vendorName: giftCard.vendor.businessName,
      expiresAt: giftCard.expiresAt,
      activatedAt: giftCard.activatedAt,
    };
  }

  async listVendorGiftCards(userId: string, take = 20) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found.');
    }

    const limit = Math.min(Math.max(take, 1), 100);

    return this.prisma.giftCard.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        redemptions: true,
      },
    });
  }

  async getVendorGiftCard(userId: string, giftCardId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found.');
    }

    const giftCard = await this.prisma.giftCard.findFirst({
      where: {
        id: giftCardId,
        vendorId: vendor.id,
      },
      include: {
        redemptions: true,
      },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found.');
    }

    return giftCard;
  }

  async applyGiftCardToBooking(
    tx: Prisma.TransactionClient,
    params: {
      vendorId: string;
      currency: string;
      giftCardCode: string;
      depositDue: number;
      balanceDue: number;
      bookingId: string;
    },
  ): Promise<GiftCardApplicationResult> {
    const card = await tx.giftCard.findUnique({
      where: { code: this.normalizeCode(params.giftCardCode) },
    });

    if (!card) {
      throw new NotFoundException('Gift card not found.');
    }

    if (card.vendorId !== params.vendorId) {
      throw new BadRequestException('Gift card does not belong to this vendor.');
    }

    if (card.currency.toUpperCase() !== params.currency.toUpperCase()) {
      throw new BadRequestException('Gift card currency mismatch.');
    }

    if (this.isExpired(card.expiresAt)) {
      await tx.giftCard.update({
        where: { id: card.id },
        data: { status: GiftCardStatus.EXPIRED },
      });
      throw new BadRequestException('Gift card has expired.');
    }

    if (card.status !== GiftCardStatus.ACTIVE) {
      throw new BadRequestException('Gift card is not active.');
    }

    if (card.balancePesewas <= 0) {
      await tx.giftCard.update({
        where: { id: card.id },
        data: { status: GiftCardStatus.DEPLETED },
      });
      throw new BadRequestException('Gift card has no remaining balance.');
    }

    const appliedDeposit = Math.min(card.balancePesewas, params.depositDue);
    const remainingAfterDeposit = card.balancePesewas - appliedDeposit;
    const appliedBalance = Math.min(remainingAfterDeposit, params.balanceDue);
    const totalApplied = appliedDeposit + appliedBalance;

    const newBalance = card.balancePesewas - totalApplied;
    const nextStatus =
      newBalance <= 0 ? GiftCardStatus.DEPLETED : GiftCardStatus.ACTIVE;

    await tx.giftCard.update({
      where: { id: card.id },
      data: {
        balancePesewas: newBalance,
        status: nextStatus,
      },
    });

    await tx.giftCardRedemption.create({
      data: {
        giftCardId: card.id,
        bookingId: params.bookingId,
        amountPesewas: totalApplied,
        depositAmountPesewas: appliedDeposit,
        balanceAmountPesewas: appliedBalance,
      },
    });

    return {
      remainingDeposit: params.depositDue - appliedDeposit,
      remainingBalance: params.balanceDue - appliedBalance,
      appliedDeposit,
      appliedBalance,
      giftCardId: card.id,
    };
  }

  async refundGiftCardRedemptionsForBooking(
    tx: Prisma.TransactionClient,
    bookingId: string,
  ) {
    const redemptions = await tx.giftCardRedemption.findMany({
      where: { bookingId, refundedAt: null },
      include: { giftCard: true },
    });

    if (redemptions.length === 0) {
      return;
    }

    const now = new Date();

    for (const redemption of redemptions) {
      const card = redemption.giftCard;
      const newBalance = card.balancePesewas + redemption.amountPesewas;
      const nextStatus =
        card.status === GiftCardStatus.CANCELLED ||
        card.status === GiftCardStatus.EXPIRED
          ? card.status
          : GiftCardStatus.ACTIVE;

      await tx.giftCard.update({
        where: { id: card.id },
        data: {
          balancePesewas: newBalance,
          status: nextStatus,
        },
      });

      await tx.giftCardRedemption.update({
        where: { id: redemption.id },
        data: { refundedAt: now },
      });
    }
  }

  async activateGiftCard(id: string) {
    await this.prisma.giftCard.update({
      where: { id },
      data: {
        status: GiftCardStatus.ACTIVE,
        activatedAt: new Date(),
      },
    });
  }

  async markGiftCardCancelled(id: string) {
    await this.prisma.giftCard.update({
      where: { id },
      data: {
        status: GiftCardStatus.CANCELLED,
        balancePesewas: 0,
      },
    });
  }

  private buildGiftCardCheckoutPayload(params: {
    reference: string;
    amount: number;
    currency: string;
    purchaserEmail: string;
    giftCardId: string;
    vendorId: string;
  }): PaystackCheckoutPayload {
    return {
      publicKey: this.paystack.getPublicKey(),
      reference: params.reference,
      amountPesewas: params.amount,
      currency: params.currency,
      email: params.purchaserEmail,
      metadata: {
        type: 'GIFT_CARD',
        giftCardId: params.giftCardId,
        vendorId: params.vendorId,
      },
    };
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempts = 0; attempts < 5; attempts += 1) {
      const candidate = this.normalizeCode(this.buildCode());
      const exists = await this.prisma.giftCard.findUnique({
        where: { code: candidate },
        select: { id: true },
      });

      if (!exists) {
        return candidate;
      }
    }

    throw new Error('Unable to generate a unique gift card code.');
  }

  private buildCode(): string {
    const segment = () => randomBytes(2).toString('hex').toUpperCase();
    return `GL-${segment()}-${segment()}-${segment()}`;
  }

  private normalizeCode(code: string): string {
    return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  private assertAmount(amount: number): number {
    if (!Number.isInteger(amount) || amount < MIN_GIFT_CARD_AMOUNT) {
      throw new BadRequestException(
        `Gift card amount must be at least ${MIN_GIFT_CARD_AMOUNT} pesewas.`,
      );
    }
    return amount;
  }

  private isExpired(expiresAt: Date | string | null | undefined): boolean {
    if (!expiresAt) {
      return false;
    }
    const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    if (Number.isNaN(date.getTime())) {
      return false;
    }
    return date.getTime() < Date.now();
  }
}
