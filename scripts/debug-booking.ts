
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const serviceId = 'cmkiejqgy000bs8drtbzrmocj';
  const seatId = 'cmkfa9jkv0024sb0fdizfv8kr';
  const startAt = '2026-01-24T11:00:00.000Z';

  console.log('--- Checking Service ---');
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { vendor: true }
  });
  console.log('Service:', JSON.stringify(service, null, 2));

  if (!service) {
    console.log('Service NOT FOUND');
    return;
  }

  console.log('\n--- Checking Seat ---');
  const seat = await prisma.serviceSeat.findUnique({
    where: { id: seatId },
  });
  console.log('Seat:', JSON.stringify(seat, null, 2));

  if (!seat) {
    console.log('Seat NOT FOUND');
  } else if (seat.vendorId !== service.vendorId) {
    console.log(`Seat belongs to different vendor! Seat Vendor: ${seat.vendorId}, Service Vendor: ${service.vendorId}`);
  }

  console.log('\n--- Checking Seat-Service Link ---');
  const link = await prisma.serviceSeatService.findUnique({
    where: { serviceId_seatId: { serviceId, seatId } }
  });
  console.log('Link:', JSON.stringify(link, null, 2));

  const allLinks = await prisma.serviceSeatService.findMany({
    where: { serviceId }
  });
  console.log('All seats linked to this service:', allLinks.map(l => l.seatId));

  console.log('\n--- Checking Existing Bookings for this slot ---');
  const start = new Date(startAt);
  const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);
  
  const overlapping = await prisma.booking.findMany({
    where: {
      vendorId: service.vendorId,
      status: { in: ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED'] },
      scheduledStart: { lt: end },
      scheduledEnd: { gt: start },
    }
  });
  console.log('Overlapping Bookings count:', overlapping.length);
  overlapping.forEach(b => {
    console.log(`- Booking ${b.id}: Start ${b.scheduledStart.toISOString()}, End ${b.scheduledEnd.toISOString()}, Seat ${b.seatId}`);
  });

  console.log('\n--- Checking Availability Slots via Query ---');
  // Mocking listAvailabilitySlots logic roughly
  const rangeStart = new Date(startAt);
  rangeStart.setUTCHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart.getTime() + 24 * 60 * 60 * 1000);

  const [weeklyWindows, overrides] = await prisma.$transaction([
    prisma.weeklyAvailability.findMany({ where: { vendorId: service.vendorId } }),
    prisma.availabilityOverride.findMany({
      where: {
        vendorId: service.vendorId,
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
      },
    }),
  ]);
  
  console.log('Weekly Windows count:', weeklyWindows.length);
  console.log('Overrides count:', overrides.length);

  // We need to know if the slot exists in the generated list
  // I'll just check if the weekly windows cover 11:00 AM on Saturday (2026-01-24 is Saturday)
  const dayOfWeek = new Date(startAt).getUTCDay(); // 6 for Saturday
  const startMinute = 11 * 60; // 660
  const endMinute = startMinute + service.durationMinutes;

  const matchingWindow = weeklyWindows.find(w => 
    w.dayOfWeek === dayOfWeek && 
    w.startMinute <= startMinute && 
    w.endMinute >= endMinute
  );

  console.log(`Day of week: ${dayOfWeek}, Requested Minutes: ${startMinute}-${endMinute}`);
  if (matchingWindow) {
    console.log('Found matching weekly window:', JSON.stringify(matchingWindow, null, 2));
  } else {
    console.log('NO MATCHING WEEKLY WINDOW FOUND');
  }

  const blockingOverride = overrides.find(o => 
    o.type === 'BLOCK' && o.startsAt <= new Date(startAt) && o.endsAt >= new Date(startAt)
  );
  if (blockingOverride) {
    console.log('FOUND BLOCKING OVERRIDE:', JSON.stringify(blockingOverride, null, 2));
  }

  await prisma.$disconnect();
}

main();

