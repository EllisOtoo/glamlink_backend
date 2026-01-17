import { PrismaClient, BookingStatus } from '@prisma/client';

const prisma = new PrismaClient();

const nanoid = (length: number) => Math.random().toString(36).substring(2, 2 + length);

const SERVICE_ID = 'cmjyki3wv0005s8jj9rk5pqer';
const VENDOR_ID = 'cmjykgt4m0003s8jjbarymo59';

const REVIEWS_DATA = [
  { rating: 5, comment: "Absolutely loved the hair styling! The stylist really listened to what I wanted and executed it perfectly.", name: "Abena Mansa" },
  { rating: 5, comment: "Great service, very professional. My hair has never looked better.", name: "Kwame Boateng" },
  { rating: 4, comment: "Good experience overall. Only downside was a small delay in starting, but the result was worth it.", name: "Efua Mensah" },
  { rating: 5, comment: "The best hair styling in town! Highly recommend to everyone.", name: "Kofi Owusu" },
  { rating: 5, comment: "I'm so happy with my new look. Thank you so much!", name: "Ama Serwaa" },
  { rating: 4, comment: "Professional and clean environment. Great results.", name: "Nii Armah" },
  { rating: 5, comment: "Stylist was very friendly and did an amazing job. Will definitely be coming back.", name: "Esi Taylor" },
  { rating: 3, comment: "It was okay, but I've had better. Might try somewhere else next time.", name: "Yaw Asante" },
  { rating: 5, comment: "Exceptional service! Exceeded my expectations.", name: "Adjoa Poku" },
  { rating: 5, comment: "My go-to place for hair styling. Always satisfied.", name: "Papa Yaw" },
  { rating: 4, comment: "Very satisfied with the result. Helpful tips on maintenance too.", name: "Nana Akua" },
  { rating: 5, comment: "Excellent service from start to finish. Very impressive.", name: "Kwiku Addo" },
  { rating: 5, comment: "Transformative experience. I feel so much more confident now.", name: "Maame Yaa" },
  { rating: 2, comment: "The wait time was way too long and I wasn't happy with the final look.", name: "Kwabena Osei" },
  { rating: 5, comment: "Truly professional styling. Worth every penny.", name: "Araba Quansah" },
  { rating: 4, comment: "Nice atmosphere and good results. Would recommend.", name: "Kojo Frimpong" },
  { rating: 5, comment: "Fast, efficient and stylish. Loved it!", name: "Afi Amankwah" },
  { rating: 5, comment: "Highly skilled stylists. Very happy with the service.", name: "Tetteh Quarshie" },
  { rating: 4, comment: "Great style, though it was a bit pricier than expected.", name: "Akosua Baah" },
  { rating: 5, comment: "Top-notch service! Never disappointed.", name: "Ben Appiah" },
];

async function seedReviews() {
  console.log('--- Starting Review Seeding ---');

  for (const data of REVIEWS_DATA) {
    const userId = `seed-user-${nanoid(5)}`;
    const email = `${userId}@example.com`;

    // 1. Create User
    const user = await prisma.user.create({
      data: {
        id: userId,
        email: email,
        customerProfile: {
          create: {
            fullName: data.name,
          }
        }
      }
    });

    // 2. Create Booking
    const bookingId = `seed-booking-${nanoid(5)}`;
    const booking = await prisma.booking.create({
      data: {
        id: bookingId,
        reference: `GL-${nanoid(8).toUpperCase()}`,
        vendorId: VENDOR_ID,
        serviceId: SERVICE_ID,
        customerUserId: user.id,
        customerName: data.name,
        customerEmail: email,
        status: 'COMPLETED' as BookingStatus,
        scheduledStart: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)), // Random date in last 30 days
        scheduledEnd: new Date(),
        pricePesewas: 5000,
        depositPesewas: 1000,
        balancePesewas: 4000,
        completedAt: new Date(),
      }
    });

    // 3. Create Review
    await prisma.review.create({
      data: {
        bookingId: booking.id,
        vendorId: VENDOR_ID,
        customerUserId: user.id,
        rating: data.rating,
        comment: data.comment,
      }
    });

    process.stdout.write('.');
  }

  console.log('\n--- Reviews created. Updating denormalized metrics ---');

  // 4. Update Service Metrics
  const serviceReviews = await prisma.review.findMany({
    where: { booking: { serviceId: SERVICE_ID } },
    select: { rating: true }
  });

  const sCount = serviceReviews.length;
  const sAvg = serviceReviews.reduce((acc, r) => acc + r.rating, 0) / sCount;

  await prisma.service.update({
    where: { id: SERVICE_ID },
    data: {
      ratingCount: sCount,
      ratingAverage: sAvg,
      bookingCount: { increment: 20 }
    }
  });

  // 5. Update Vendor Metrics
  const vendorReviews = await prisma.review.findMany({
    where: { vendorId: VENDOR_ID },
    select: { rating: true }
  });

  const vCount = vendorReviews.length;
  const vAvg = vendorReviews.reduce((acc, r) => acc + r.rating, 0) / vCount;

  await prisma.vendor.update({
    where: { id: VENDOR_ID },
    data: {
      ratingCount: vCount,
      ratingAverage: vAvg,
      bookingCount: { increment: 20 }
    }
  });

  console.log('--- Seeding Complete ---');
}

seedReviews()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
