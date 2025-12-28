import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  try {
    const vendors = await prisma.vendor.count();
    const services = await prisma.service.count();
    const portfolioItems = await prisma.portfolioItem.count();
    const reviews = await prisma.review.count();
    const bookings = await prisma.booking.count();

    console.log('--- Database Integrity Check ---');
    console.log(`Vendors: ${vendors}`);
    console.log(`Services: ${services}`);
    console.log(`Portfolio Items: ${portfolioItems}`);
    console.log(`Reviews: ${reviews}`);
    console.log(`Bookings: ${bookings}`);
    console.log('-------------------------------');

    if (vendors > 0) {
      const sampleVendor = await prisma.vendor.findFirst({ select: { handle: true, businessName: true } });
      console.log('Sample Vendor:', sampleVendor?.businessName, `(@${sampleVendor?.handle})`);
    } else {
      console.log('WARNING: No vendors found in the database.');
    }

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
