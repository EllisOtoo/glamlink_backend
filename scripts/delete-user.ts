
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetEmail = 'ellisotoo@gmail.com';
  console.log(`--- Deleting records for email: ${targetEmail} ---`);

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: { vendor: true },
  });

  if (!user) {
    console.log('User not found.');
    return;
  }

  console.log(`Found user: ${user.id} (${user.email})`);

  if (user.vendor) {
    console.log(`Found associated vendor: ${user.vendor.id} (${user.vendor.businessName})`);
    console.log('Deleting vendor record (cascading to services, bookings, etc.)...');
    
    // Vendor deletion cascades to most related entities per schema
    await prisma.vendor.delete({
      where: { id: user.vendor.id },
    });
    console.log('✅ Vendor deleted.');
  } else {
    console.log('No vendor profile linked to this user.');
  }

  console.log('Deleting user record...');
  await prisma.user.delete({
    where: { id: user.id },
  });
  console.log('✅ User deleted.');

  console.log('--- Deletion Completed ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
