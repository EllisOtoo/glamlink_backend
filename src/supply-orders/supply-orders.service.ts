import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, SupplyOrderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma';
import { PaystackService } from '../payments/paystack.service';
import { CreateSupplyOrderDto } from './dto/create-supply-order.dto';

const pilotEnabled = (process.env.SUPPLIES_PILOT_ENABLED ?? '').toLowerCase() === 'true';
const pilotAllowlist = new Set(
  (process.env.SUPPLIES_PILOT_VENDOR_IDS ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean),
);

@Injectable()
export class SupplyOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
  ) {}

  async checkout(userId: string, dto: CreateSupplyOrderDto) {
    const vendor = await this.requireVendor(userId);
    this.assertPilot(vendor.id);

    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.supplyProduct.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: {
        supplier: true,
        prices: {
          orderBy: { startsAt: 'desc' },
          take: 1,
        },
      },
    });

    if (products.length !== dto.items.length) {
      throw new NotFoundException('One or more products not found or inactive.');
    }

    const itemsData = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new NotFoundException('Product not found.');
      }
      const price = product.prices[0];
      if (!price) {
        throw new BadRequestException(`Product ${product.name} missing price.`);
      }
      return {
        product,
        quantity: item.quantity,
        price,
      };
    });

    const totalCents = itemsData.reduce(
      (sum, item) => sum + item.price.vendorPriceCents * item.quantity,
      dto.deliveryFeeCents ?? 0,
    );

    if (totalCents <= 0) {
      throw new BadRequestException('Order total must be greater than zero.');
    }

    const paystackRef = `supp_${randomUUID()}`;

    const paymentIntent = await this.prisma.paymentIntent.create({
      data: {
        provider: 'PAYSTACK',
        providerRef: paystackRef,
        status: 'REQUIRES_PAYMENT_METHOD',
        amountPesewas: totalCents,
        currency: 'GHS',
        metadata: {
          type: 'SUPPLY_ORDER',
        },
      },
    });

    const order = await this.prisma.supplyOrder.create({
      data: {
        vendorId: vendor.id,
        totalCents,
        deliveryFeeCents: dto.deliveryFeeCents ?? 0,
        status: SupplyOrderStatus.REQUIRES_PAYMENT,
        paymentIntentId: paymentIntent.id,
        note: dto.note ?? null,
        items: {
          create: itemsData.map((item) => ({
            productId: item.product.id,
            supplierId: item.product.supplierId,
            name: item.product.name,
            category: item.product.category,
            unit: item.product.unit,
            leadTimeDays: item.product.leadTimeDays,
            quantity: item.quantity,
            vendorPriceCents: item.price.vendorPriceCents,
            supplierCostCents: item.price.supplierCostCents,
          })),
        },
        history: {
          create: {
            fromStatus: SupplyOrderStatus.DRAFT,
            toStatus: SupplyOrderStatus.REQUIRES_PAYMENT,
            note: 'Order created, awaiting payment.',
          },
        },
      },
    });

    await this.prisma.paymentIntent.update({
      where: { id: paymentIntent.id },
      data: {
        metadata: {
          type: 'SUPPLY_ORDER',
          orderId: order.id,
        },
      },
    });

    const paystackPayload = this.buildSupplyCheckoutPayload({
      reference: paystackRef,
      amountPesewas: totalCents,
      vendorEmail: vendor.contactEmail ?? 'no-email@glamlink.app',
    });

    return {
      orderId: order.id,
      paystack: paystackPayload,
    };
  }

  async listForVendor(userId: string) {
    const vendor = await this.requireVendor(userId);
    this.assertPilot(vendor.id);

    const orders = await this.prisma.supplyOrder.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
      },
    });
    return orders;
  }

  private buildSupplyCheckoutPayload(params: {
    reference: string;
    amountPesewas: number;
    vendorEmail: string;
  }) {
    return {
      publicKey: this.paystack.getPublicKey(),
      reference: params.reference,
      amountPesewas: params.amountPesewas,
      currency: 'GHS',
      email: params.vendorEmail,
      metadata: {
        type: 'SUPPLY_ORDER',
      },
    };
  }

  private async requireVendor(userId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });
    if (!vendor) {
      throw new ForbiddenException('Vendor profile not found.');
    }
    return vendor;
  }

  private assertPilot(vendorId: string) {
    if (!pilotEnabled) {
      throw new ForbiddenException('Supplies pilot is not enabled.');
    }
    if (pilotAllowlist.size > 0 && !pilotAllowlist.has(vendorId)) {
      throw new ForbiddenException('Supplies pilot not enabled for this vendor.');
    }
  }
}
