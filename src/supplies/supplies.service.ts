import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SupplyPrice } from '@prisma/client';
import { PrismaService } from '../prisma';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { CatalogQueryDto } from './dto/catalog-query.dto';

const productInclude: Prisma.SupplyProductInclude = {
  supplier: true,
  prices: {
    orderBy: { startsAt: 'desc' },
    take: 1,
  },
};

type ProductWithRelations = Prisma.SupplyProductGetPayload<{
  include: typeof productInclude;
}>;

@Injectable()
export class SuppliesService {
  private readonly pilotEnabled =
    (process.env.SUPPLIES_PILOT_ENABLED ?? '').toLowerCase() === 'true';
  private readonly pilotVendorAllowlist = new Set(
    (process.env.SUPPLIES_PILOT_VENDOR_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );

  constructor(private readonly prisma: PrismaService) {}

  async listSuppliers() {
    return this.prisma.supplySupplier.findMany({
      orderBy: { name: 'asc' },
    });
  }

  createSupplier(dto: CreateSupplierDto) {
    return this.prisma.supplySupplier.create({
      data: {
        name: dto.name.trim(),
        contactEmail: dto.contactEmail?.trim(),
        phoneNumber: dto.phoneNumber?.trim(),
        serviceAreas: dto.serviceAreas ?? [],
        priority: dto.priority ?? null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateSupplier(supplierId: string, dto: UpdateSupplierDto) {
    const existing = await this.prisma.supplySupplier.findUnique({
      where: { id: supplierId },
    });
    if (!existing) {
      throw new NotFoundException('Supplier not found.');
    }

    return this.prisma.supplySupplier.update({
      where: { id: supplierId },
      data: {
        name: dto.name?.trim(),
        contactEmail: dto.contactEmail?.trim(),
        phoneNumber: dto.phoneNumber?.trim(),
        serviceAreas: dto.serviceAreas ?? undefined,
        priority:
          typeof dto.priority === 'number' ? dto.priority : undefined,
        isActive:
          typeof dto.isActive === 'boolean' ? dto.isActive : undefined,
      },
    });
  }

  async listProducts(filter: ListProductsDto) {
    const products = await this.prisma.supplyProduct.findMany({
      where: {
        supplierId: filter.supplierId,
        category: filter.category,
        inStock: filter.inStock,
        isActive: filter.isActive,
      },
      include: productInclude,
      orderBy: { createdAt: 'desc' },
    });

    return products.map((product) => this.toAdminView(product));
  }

  async createProduct(dto: CreateProductDto) {
    await this.ensureSupplierExists(dto.supplierId);
    const price = this.buildPrice(dto.supplierCostCents, dto.markupPercent);
    const inStock =
      typeof dto.inStock === 'boolean' ? dto.inStock : true;

    const product = await this.prisma.supplyProduct.create({
      data: {
        supplierId: dto.supplierId,
        name: dto.name.trim(),
        category: dto.category.trim(),
        description: dto.description?.trim(),
        unit: dto.unit?.trim(),
        leadTimeDays: dto.leadTimeDays ?? null,
        mediaUrl: dto.mediaUrl,
        attributes: dto.attributes ?? undefined,
        isActive: dto.isActive ?? true,
        inStock,
        stockRefreshedAt: new Date(),
        prices: {
          create: price,
        },
      },
      include: productInclude,
    });

    return this.toAdminView(product);
  }

  async updateProduct(productId: string, dto: UpdateProductDto) {
    const product = await this.prisma.supplyProduct.findUnique({
      where: { id: productId },
      include: { supplier: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    if (
      (dto.supplierCostCents !== undefined &&
        dto.markupPercent === undefined) ||
      (dto.supplierCostCents === undefined &&
        dto.markupPercent !== undefined)
    ) {
      throw new BadRequestException(
        'supplierCostCents and markupPercent must be provided together.',
      );
    }

    if (dto.supplierId) {
      await this.ensureSupplierExists(dto.supplierId);
    }

    await this.prisma.supplyProduct.update({
      where: { id: productId },
      data: {
        supplierId: dto.supplierId ?? undefined,
        name: dto.name?.trim(),
        category: dto.category?.trim(),
        description: dto.description?.trim(),
        unit: dto.unit?.trim(),
        leadTimeDays: dto.leadTimeDays ?? undefined,
        mediaUrl: dto.mediaUrl ?? undefined,
        attributes: dto.attributes ?? undefined,
        isActive:
          typeof dto.isActive === 'boolean' ? dto.isActive : undefined,
        inStock:
          typeof dto.inStock === 'boolean' ? dto.inStock : undefined,
        stockRefreshedAt:
          typeof dto.inStock === 'boolean' ? new Date() : undefined,
      },
    });

    if (
      dto.supplierCostCents !== undefined &&
      dto.markupPercent !== undefined
    ) {
      const price = this.buildPrice(
        dto.supplierCostCents,
        dto.markupPercent,
      );
      await this.prisma.supplyPrice.create({
        data: { ...price, productId },
      });
    }

    const updated = await this.prisma.supplyProduct.findUnique({
      where: { id: productId },
      include: productInclude,
    });
    if (!updated) {
      throw new NotFoundException('Product not found after update.');
    }
    return this.toAdminView(updated);
  }

  async listCatalogForVendor(
    userId: string,
    query: CatalogQueryDto,
  ) {
    const vendor = await this.requireVendor(userId);
    this.assertPilotAccess(vendor.id);

    const products = await this.prisma.supplyProduct.findMany({
      where: {
        isActive: true,
        inStock: true,
        category: query.category ?? undefined,
      },
      include: productInclude,
      orderBy: { createdAt: 'desc' },
    });

    return products
      .map((product) => this.toVendorView(product))
      .filter(Boolean);
  }

  private buildPrice(
    supplierCostCents: number,
    markupPercent: number,
  ): Omit<SupplyPrice, 'id' | 'productId'> {
    if (supplierCostCents < 0) {
      throw new BadRequestException('supplierCostCents must be >= 0.');
    }
    if (markupPercent < 0 || markupPercent > 100) {
      throw new BadRequestException(
        'markupPercent must be between 0 and 100.',
      );
    }
    const markupBasisPoints = markupPercent * 100;
    const vendorPriceCents = Math.ceil(
      supplierCostCents * (1 + markupPercent / 100),
    );

    return {
      supplierCostCents,
      markupBasisPoints,
      vendorPriceCents,
      startsAt: new Date(),
      endsAt: null,
      createdAt: new Date(),
    };
  }

  private toAdminView(product: ProductWithRelations) {
    const price = product.prices[0];
    return {
      id: product.id,
      supplierId: product.supplierId,
      supplierName: product.supplier.name,
      category: product.category,
      name: product.name,
      description: product.description,
      unit: product.unit,
      leadTimeDays: product.leadTimeDays,
      mediaUrl: product.mediaUrl,
      attributes: product.attributes,
      isActive: product.isActive,
      inStock: product.inStock,
      stockRefreshedAt: product.stockRefreshedAt,
      price: price
        ? {
            supplierCostCents: price.supplierCostCents,
            markupBasisPoints: price.markupBasisPoints,
            vendorPriceCents: price.vendorPriceCents,
            startsAt: price.startsAt,
          }
        : null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private toVendorView(product: ProductWithRelations) {
    const price = product.prices[0];
    if (!price) {
      return null;
    }
    return {
      id: product.id,
      supplierId: product.supplierId,
      supplierName: product.supplier.name,
      category: product.category,
      name: product.name,
      description: product.description,
      unit: product.unit,
      leadTimeDays: product.leadTimeDays,
      mediaUrl: product.mediaUrl,
      attributes: product.attributes,
      inStock: product.inStock,
      stockRefreshedAt: product.stockRefreshedAt,
      vendorPriceCents: price.vendorPriceCents,
      markupBasisPoints: price.markupBasisPoints,
    };
  }

  private async ensureSupplierExists(supplierId: string) {
    const supplier = await this.prisma.supplySupplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found.');
    }
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

  private assertPilotAccess(vendorId: string) {
    if (!this.pilotEnabled) {
      throw new ForbiddenException('Supplies pilot is not enabled.');
    }

    if (
      this.pilotVendorAllowlist.size > 0 &&
      !this.pilotVendorAllowlist.has(vendorId)
    ) {
      throw new ForbiddenException(
        'Supplies pilot not enabled for this vendor.',
      );
    }
  }
}
