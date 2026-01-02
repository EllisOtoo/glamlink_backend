
import { PrismaClient, VendorStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Smoke Test: Vendor Verification Relaxation ---');

  // 1. Create a DRAFT vendor
  const user = await prisma.user.create({
    data: {
      email: `test-vendor-${Date.now()}@example.com`,
      role: 'VENDOR',
    },
  });

  const vendor = await prisma.vendor.create({
    data: {
      userId: user.id,
      businessName: 'Draft Test Vendor',
      handle: `draft-test-${Date.now()}`,
      status: VendorStatus.DRAFT,
    },
  });

  const service = await prisma.service.create({
    data: {
      vendorId: vendor.id,
      name: 'Draft Test Service',
      priceCents: 1000,
      durationMinutes: 60,
      isActive: true,
    },
  });

  console.log(`Created DRAFT vendor: ${vendor.handle}`);

  // 2. Verify discovery (PublicCatalogService equivalent query)
  const discoveredVendors = await prisma.vendor.findMany({
    where: {
      status: { in: [VendorStatus.VERIFIED, VendorStatus.DRAFT, VendorStatus.PENDING_REVIEW] },
      id: vendor.id
    }
  });

  if (discoveredVendors.length > 0) {
    console.log('✅ DRAFT vendor is visible in discovery query.');
  } else {
    console.log('❌ DRAFT vendor is NOT visible in discovery query.');
  }

  // 3. Verify service discovery
  const discoveredServices = await prisma.service.findMany({
    where: {
      isActive: true,
      vendor: {
        status: { in: [VendorStatus.VERIFIED, VendorStatus.DRAFT, VendorStatus.PENDING_REVIEW] }
      },
      id: service.id
    }
  });

  if (discoveredServices.length > 0) {
    console.log('✅ DRAFT vendor service is visible in discovery query.');
  } else {
    console.log('❌ DRAFT vendor service is NOT visible in discovery query.');
  }

  // 4. Clean up
  await prisma.service.delete({ where: { id: service.id } });
  await prisma.vendor.delete({ where: { id: vendor.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log('--- Smoke Test Completed ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
