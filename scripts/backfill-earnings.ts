import { PrismaClient, BookingStatus, TransactionType, TransactionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillEarnings() {
  console.log('Starting backfill of earnings for completed bookings...');

  const completedBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.COMPLETED,
    },
    include: {
      vendor: true,
      walletTransactions: {
        where: {
          type: TransactionType.EARNING,
          // The bookingId is implicitly filtered by Prisma when including related records.
          // Adding it explicitly here would require a specific booking ID, which is not available
          // at this level of the query. If you intended to filter transactions by a specific
          // booking ID, that would typically be done in a separate query or a different structure.
          // For including transactions related to *each* booking found, Prisma handles the relation automatically.
        },
      },
    },
  });

  console.log(`Found ${completedBookings.length} completed bookings.`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const booking of completedBookings) {
    if (booking.walletTransactions.length > 0) {
      skippedCount++;
      continue;
    }

    // Clearance period: 1 day after completion
    // If completion date is missing, use scheduled end
    const completionDate = booking.completedAt || booking.scheduledEnd;
    const availableAt = new Date(completionDate);
    availableAt.setDate(availableAt.getDate() + 1);

    await prisma.walletTransaction.create({
      data: {
        vendorId: booking.vendorId,
        amountPesewas: booking.pricePesewas,
        type: TransactionType.EARNING,
        status: TransactionStatus.COMPLETED,
        referenceId: booking.id,
        description: `Earning from booking ${booking.reference} (Backfilled)`,
        createdAt: completionDate,
        availableAt: availableAt,
      },
    });

    createdCount++;
  }

  console.log(`Backfill complete!`);
  console.log(`Created: ${createdCount}`);
  console.log(`Skipped (already exist): ${skippedCount}`);
}

backfillEarnings()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
