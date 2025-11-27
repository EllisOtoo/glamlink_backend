import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SupplierSeed = {
  name: string;
  contactEmail?: string;
  phoneNumber?: string;
  serviceAreas?: string[];
  priority?: number;
};

type ProductSeed = {
  supplierName: string;
  category: string;
  name: string;
  description?: string;
  unit?: string;
  leadTimeDays?: number;
  mediaUrl?: string;
  inStock?: boolean;
  supplierCostCents: number;
  markupPercent: number;
};

const suppliers: SupplierSeed[] = [
  {
    name: 'Glow Beauty Supply',
    contactEmail: 'ops@glowbeauty.example',
    phoneNumber: '+233555000111',
    serviceAreas: ['Accra'],
    priority: 1,
  },
  {
    name: 'Nail Lab Depot',
    contactEmail: 'hello@naillab.example',
    phoneNumber: '+233555000222',
    serviceAreas: ['Accra'],
    priority: 2,
  },
  {
    name: 'Luxe Lash Hub',
    contactEmail: 'support@luxelash.example',
    phoneNumber: '+233555000333',
    serviceAreas: ['Accra'],
    priority: 2,
  },
];

const products: ProductSeed[] = [
  // Hair
  {
    supplierName: 'Glow Beauty Supply',
    category: 'hair',
    name: 'HD Lace Closure 5x5',
    unit: 'piece',
    leadTimeDays: 1,
    description: 'Transparent HD closure, pre-plucked, ready to tint.',
    supplierCostCents: 4500,
    markupPercent: 18,
  },
  {
    supplierName: 'Glow Beauty Supply',
    category: 'hair',
    name: 'HD Lace Frontal 13x4',
    unit: 'piece',
    leadTimeDays: 1,
    description: 'Soft HD lace frontal for seamless installs.',
    supplierCostCents: 6200,
    markupPercent: 18,
  },
  {
    supplierName: 'Glow Beauty Supply',
    category: 'hair',
    name: 'Straight Bundle 10"',
    unit: 'bundle',
    leadTimeDays: 1,
    description: 'Single donor straight bundle, double wefted.',
    supplierCostCents: 3800,
    markupPercent: 15,
  },
  {
    supplierName: 'Glow Beauty Supply',
    category: 'hair',
    name: 'Straight Bundle 14"',
    unit: 'bundle',
    leadTimeDays: 1,
    description: 'Silky straight, 14 inch, full density.',
    supplierCostCents: 5200,
    markupPercent: 15,
  },
  {
    supplierName: 'Glow Beauty Supply',
    category: 'hair',
    name: 'Body Wave Bundle 16"',
    unit: 'bundle',
    leadTimeDays: 1,
    description: 'Body wave texture, holds curls well.',
    supplierCostCents: 5800,
    markupPercent: 15,
  },
  {
    supplierName: 'Glow Beauty Supply',
    category: 'hair',
    name: 'Lace Glue 1.3oz',
    unit: 'bottle',
    leadTimeDays: 0,
    description: 'Strong hold lace adhesive, humidity resistant.',
    supplierCostCents: 1800,
    markupPercent: 16,
  },
  {
    supplierName: 'Glow Beauty Supply',
    category: 'hair',
    name: 'Knot Healer Lace Tint',
    unit: 'bottle',
    leadTimeDays: 0,
    description: 'Tint spray for lace knots, multiple undertones.',
    supplierCostCents: 1500,
    markupPercent: 16,
  },
  {
    supplierName: 'Glow Beauty Supply',
    category: 'hair',
    name: 'Edge Control Wax',
    unit: 'jar',
    leadTimeDays: 0,
    description: 'Strong hold, non-flaking edge control.',
    supplierCostCents: 900,
    markupPercent: 18,
  },
  // Nails
  {
    supplierName: 'Nail Lab Depot',
    category: 'nails',
    name: 'Gel Polish — Nude Beige',
    unit: 'bottle',
    leadTimeDays: 0,
    description: 'Hema-free gel polish, high gloss nude.',
    supplierCostCents: 850,
    markupPercent: 15,
  },
  {
    supplierName: 'Nail Lab Depot',
    category: 'nails',
    name: 'Gel Polish — Fire Red',
    unit: 'bottle',
    leadTimeDays: 0,
    description: 'Rich red gel polish, 2-coat coverage.',
    supplierCostCents: 850,
    markupPercent: 15,
  },
  {
    supplierName: 'Nail Lab Depot',
    category: 'nails',
    name: 'No Wipe Top Coat',
    unit: 'bottle',
    leadTimeDays: 0,
    description: 'Scratch-resistant top coat, 60s cure.',
    supplierCostCents: 900,
    markupPercent: 15,
  },
  {
    supplierName: 'Nail Lab Depot',
    category: 'nails',
    name: 'Rubber Base Coat',
    unit: 'bottle',
    leadTimeDays: 0,
    description: 'Self-leveling base for overlays and BIAB.',
    supplierCostCents: 950,
    markupPercent: 15,
  },
  {
    supplierName: 'Nail Lab Depot',
    category: 'nails',
    name: 'Coffin Nail Tips — 500pcs',
    unit: 'box',
    leadTimeDays: 1,
    description: 'Pre-shaped coffin tips, clear, 10 sizes.',
    supplierCostCents: 1200,
    markupPercent: 16,
  },
  {
    supplierName: 'Nail Lab Depot',
    category: 'nails',
    name: 'Nail Files 180/240 — 10 pack',
    unit: 'pack',
    leadTimeDays: 0,
    description: 'Durable washable files, 180/240 grit.',
    supplierCostCents: 700,
    markupPercent: 16,
  },
  // Lashes
  {
    supplierName: 'Luxe Lash Hub',
    category: 'lashes',
    name: 'Classic Lash Tray 0.15 C — 12mm',
    unit: 'tray',
    leadTimeDays: 1,
    description: 'Matte black, non-kink lashes for classics.',
    supplierCostCents: 1500,
    markupPercent: 15,
  },
  {
    supplierName: 'Luxe Lash Hub',
    category: 'lashes',
    name: 'Hybrid Lash Tray 0.07 D — Mix 8-14mm',
    unit: 'tray',
    leadTimeDays: 1,
    description: 'Mix tray for hybrid/volume sets, easy fan.',
    supplierCostCents: 1700,
    markupPercent: 15,
  },
  {
    supplierName: 'Luxe Lash Hub',
    category: 'lashes',
    name: 'Premade Fans 3D C — Mix',
    unit: 'tray',
    leadTimeDays: 1,
    description: 'Heat-bonded premades for speedier sets.',
    supplierCostCents: 2000,
    markupPercent: 15,
  },
  {
    supplierName: 'Luxe Lash Hub',
    category: 'lashes',
    name: 'Lash Adhesive — Clear 5ml',
    unit: 'bottle',
    leadTimeDays: 0,
    description: '1-2s dry time, low fumes, humidity friendly.',
    supplierCostCents: 1800,
    markupPercent: 16,
  },
  {
    supplierName: 'Luxe Lash Hub',
    category: 'lashes',
    name: 'Eye Pads Lint-Free — 50 pack',
    unit: 'pack',
    leadTimeDays: 0,
    description: 'Hydrogel pads, lint-free, secure hold.',
    supplierCostCents: 900,
    markupPercent: 16,
  },
  {
    supplierName: 'Luxe Lash Hub',
    category: 'lashes',
    name: 'Microbrushes — 100 pack',
    unit: 'pack',
    leadTimeDays: 0,
    description: 'Fine tip applicators for primer and remover.',
    supplierCostCents: 700,
    markupPercent: 16,
  },
];

async function upsertSupplier(seed: SupplierSeed) {
  const existing = await prisma.supplySupplier.findFirst({
    where: { name: seed.name },
  });

  if (existing) {
    return prisma.supplySupplier.update({
      where: { id: existing.id },
      data: {
        contactEmail: seed.contactEmail ?? existing.contactEmail,
        phoneNumber: seed.phoneNumber ?? existing.phoneNumber,
        serviceAreas: seed.serviceAreas ?? existing.serviceAreas,
        priority: seed.priority ?? existing.priority,
        isActive: true,
      },
    });
  }

  return prisma.supplySupplier.create({
    data: {
      name: seed.name,
      contactEmail: seed.contactEmail,
      phoneNumber: seed.phoneNumber,
      serviceAreas: seed.serviceAreas ?? [],
      priority: seed.priority ?? null,
      isActive: true,
    },
  });
}

async function upsertProduct(seed: ProductSeed, supplierId: string) {
  const existing = await prisma.supplyProduct.findFirst({
    where: { name: seed.name, supplierId },
  });

  const price = buildPrice(seed.supplierCostCents, seed.markupPercent);
  const commonData = {
    category: seed.category,
    description: seed.description ?? null,
    unit: seed.unit ?? null,
    leadTimeDays: seed.leadTimeDays ?? null,
    mediaUrl: seed.mediaUrl ?? null,
    isActive: true,
    inStock: seed.inStock ?? true,
    stockRefreshedAt: new Date(),
  };

  if (existing) {
    await prisma.supplyProduct.update({
      where: { id: existing.id },
      data: commonData,
    });
    await prisma.supplyPrice.create({
      data: { ...price, productId: existing.id },
    });
    return;
  }

  await prisma.supplyProduct.create({
    data: {
      supplierId,
      name: seed.name,
      ...commonData,
      prices: {
        create: price,
      },
    },
  });
}

function buildPrice(supplierCostCents: number, markupPercent: number) {
  const markupBasisPoints = Math.round(markupPercent * 100);
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

async function main() {
  console.log('Seeding suppliers and products for supplies pilot...');
  const supplierMap = new Map<string, string>();

  for (const supplier of suppliers) {
    const record = await upsertSupplier(supplier);
    supplierMap.set(supplier.name, record.id);
  }

  for (const product of products) {
    const supplierId = supplierMap.get(product.supplierName);
    if (!supplierId) {
      console.warn(
        `Skipping product ${product.name} because supplier ${product.supplierName} was not created.`,
      );
      continue;
    }
    await upsertProduct(product, supplierId);
  }

  const productCount = await prisma.supplyProduct.count();
  const supplierCount = await prisma.supplySupplier.count();

  console.log(
    `Done. Suppliers: ${supplierCount}, Products: ${productCount}.`,
  );
}

main()
  .catch((error) => {
    console.error('Seeding failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
