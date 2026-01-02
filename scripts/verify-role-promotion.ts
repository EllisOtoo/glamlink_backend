
import { PrismaClient, UserRole } from '@prisma/client';
import { VendorsService } from '../src/vendors/vendors.service';
import { StorageService } from '../src/storage/storage.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma';

async function main() {
  console.log('--- Verification Script: User Role Promotion ---');

  // 1. Setup minimal test module to get VendorsService
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      VendorsService,
      {
        provide: PrismaService,
        useValue: new PrismaClient(), // Use real client
      },
      {
        provide: StorageService,
        useValue: {}, // Mock storage as we don't need it for this test
      },
    ],
  }).compile();

  const vendorsService = moduleRef.get<VendorsService>(VendorsService);
  const prisma = moduleRef.get<PrismaService>(PrismaService);

  // 2. Create a fresh User (default role: CUSTOMER)
  const user = await prisma.user.create({
    data: {
      email: `role-test-${Date.now()}@example.com`,
    },
  });

  console.log(`Created test user: ${user.email} (Role: ${user.role})`);

  if (user.role !== 'CUSTOMER') {
    throw new Error('Initial user role is not CUSTOMER');
  }

  // 3. Create Vendor Profile via Service
  try {
    const vendor = await vendorsService.upsertProfile(user.id, {
      businessName: 'Role Test Biz',
      handle: `roletest${Date.now()}`,
    });

    console.log(`Created vendor profile: ${vendor.handle}`);

    // 4. Verify User Role Updated
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    
    console.log(`Updated user role: ${updatedUser?.role}`);

    if (updatedUser?.role === 'VENDOR') {
      console.log('✅ SUCCESS: User promoted to VENDOR role.');
    } else {
      console.log('❌ FAILURE: User role matches ' + updatedUser?.role);
    }
  } catch (e) {
    console.error('Error during test:', e);
  } finally {
    // Cleanup
    await prisma.vendor.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

main();
