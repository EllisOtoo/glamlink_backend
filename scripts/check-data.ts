import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  const accountCount = await prisma.walletTransaction.count();
  console.log('Total transactions:', accountCount);

  const transactions = await prisma.walletTransaction.findMany({
    include: { vendor: true },
    take: 5
  });
  console.log('Sample transactions:', JSON.stringify(transactions, null, 2));

  const vendors = await prisma.vendor.findMany({
    select: { id: true, businessName: true }
  });
  console.log('Vendors:', vendors);
}

checkData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
