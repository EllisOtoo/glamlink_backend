import { PrismaClient, BookingStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function syncMetrics() {
  console.log('Starting metrics synchronization...');

  // --- 1. Reset all denormalized fields ---
  console.log('Resetting all metrics...');
  await prisma.vendor.updateMany({
    data: {
      bookingCount: 0,
      ratingAverage: 0,
      ratingCount: 0,
    },
  });
  await prisma.service.updateMany({
    data: {
      bookingCount: 0,
      ratingAverage: 0,
      ratingCount: 0,
    },
  });

  // --- 2. Sync Booking Counts ---
  console.log('Syncing Booking Counts...');
  
  // Per Service
  const serviceBookingCounts = await prisma.booking.groupBy({
    by: ['serviceId'],
    where: {
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
    },
    _count: { _all: true },
  });

  for (const item of serviceBookingCounts) {
    await prisma.service.update({
      where: { id: item.serviceId },
      data: { bookingCount: item._count._all },
    });
  }

  // Per Vendor
  const vendorBookingCounts = await prisma.booking.groupBy({
    by: ['vendorId'],
    where: {
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
    },
    _count: { _all: true },
  });

  for (const item of vendorBookingCounts) {
    await prisma.vendor.update({
      where: { id: item.vendorId },
      data: { bookingCount: item._count._all },
    });
  }

  // --- 3. Sync Rating Metrics ---
  console.log('Syncing Rating Metrics...');

  // Per Vendor
  const vendorRatingMetrics = await prisma.review.groupBy({
    by: ['vendorId'],
    _avg: { rating: true },
    _count: { rating: true },
  });

  for (const item of vendorRatingMetrics) {
    if (item.vendorId) {
       await prisma.vendor.update({
         where: { id: item.vendorId },
         data: {
           ratingAverage: item._avg.rating ?? 0,
           ratingCount: item._count.rating ?? 0,
         },
       });
    }
  }

  // Per Service
  // Note: Review doesn't directly have serviceId, it has bookingId.
  // We need to aggregate reviews by booking.serviceId
  const services = await prisma.service.findMany({ select: { id: true } });
  
  for (const service of services) {
    const aggregate = await prisma.review.aggregate({
      where: {
        booking: { serviceId: service.id }
      },
      _avg: { rating: true },
      _count: { rating: true }
    });

    if (aggregate._count.rating > 0) {
      await prisma.service.update({
        where: { id: service.id },
        data: {
          ratingAverage: aggregate._avg.rating ?? 0,
          ratingCount: aggregate._count.rating ?? 0,
        }
      });
    }
  }

  console.log('Synchronization complete!');
}

syncMetrics()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
