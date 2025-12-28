import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugPortfolioData() {
  try {
    const totalCount = await prisma.portfolioItem.count();
    const items = await prisma.portfolioItem.findMany({
      take: 10,
      select: { id: true, type: true, storageKey: true, externalUrl: true }
    });

    console.log('Total Portfolio Items:', totalCount);
    console.log('Sample Data:');
    items.forEach(item => {
      console.log(`ID: ${item.id}, Type: "${item.type}", HasStorage: ${!!item.storageKey}, HasExternal: ${!!item.externalUrl}`);
    });

    const vendorsCount = await prisma.vendor.count();
    console.log('Total Vendors:', vendorsCount);

  } catch (error) {
    console.error('Error debugging database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPortfolioData();
