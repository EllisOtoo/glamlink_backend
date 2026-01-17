import { PrismaClient, BookingStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function syncBookingCounts() {
  console.log('Starting booking count synchronization...');

  // 1. Reset all counts to 0 first (optional but safer)
  await prisma.vendor.updateMany({ data: { bookingCount: 0 } });
  await prisma.service.updateMany({ data: { bookingCount: 0 } });

  // 2. Count confirmed/completed bookings per service
  const serviceCounts = await prisma.booking.groupBy({
    by: ['serviceId'],
    where: {
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
    },
    _count: { _all: true },
  });

  console.log(`Found ${serviceCounts.length} services with bookings.`);

  for (const item of serviceCounts) {
    await prisma.service.update({
      where: { id: item.serviceId },
      data: { bookingCount: item._count._all },
    });
  }

  // 3. Count confirmed/completed bookings per vendor
  const vendorCounts = await prisma.booking.groupBy({
    by: ['vendorId'],
    where: {
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
    },
    _count: { _all: true },
  });

  console.log(`Found ${vendorCounts.length} vendors with bookings.`);

  for (const item of vendorCounts) {
    await prisma.vendor.update({
      where: { id: item.vendorId },
      data: { bookingCount: item._count._all },
    });
  }

  console.log('Synchronization complete!');
}

syncBookingCounts()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
