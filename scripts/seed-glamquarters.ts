
import { PrismaClient, UserRole, BookingStatus, BookingSource } from '@prisma/client';

const prisma = new PrismaClient();

const VENDOR_ID = 'cmiek76an000ygy01x2sgejn8';
const SERVICE_ID = 'cmiekkdsm0017gy01b75q6oak';

async function main() {
  const reviews = [
    {
      rating: 5,
      comment: "GlamQuarters is the place to be! My hair color turned out exactly how I wanted. Professional and stylish.",
      userName: "Dela Tetteh",
      userEmail: "dela.t@example.com"
    },
    {
      rating: 5,
      comment: "A-plus service. The environment is so chic and the stylists are masters of their craft.",
      userName: "Naa Ayeley",
      userEmail: "naa.a@example.com"
    },
    {
      rating: 4,
      comment: "Love my new look! The hair dying process was smooth. Great vibes at the studio.",
      userName: "Ama Serwaa",
      userEmail: "ama.s@example.com"
    },
    {
      rating: 5,
      comment: "If you want premium glam, come to GlamQuarters. Five stars for sure!",
      userName: "Kweku Boateng",
      userEmail: "kweku.b@example.com"
    },
    {
      rating: 4,
      comment: "Excellent work on my hair. One of the best colorists I've visited in Accra.",
      userName: "Zeba Adams",
      userEmail: "zeba.a@example.com"
    }
  ];

  console.log(`Adding ${reviews.length} reviews for vendor ${VENDOR_ID} (glamquarters123)...`);

  for (const r of reviews) {
    // 1. Create User
    const user = await prisma.user.create({
      data: {
        email: r.userEmail,
        role: UserRole.CUSTOMER,
        customerProfile: {
          create: {
            fullName: r.userName,
          }
        }
      }
    });

    // 2. Create Booking
    const booking = await prisma.booking.create({
      data: {
        reference: `GQ-${Math.random().toString(36).substring(7).toUpperCase()}`,
        vendorId: VENDOR_ID,
        serviceId: SERVICE_ID,
        customerUserId: user.id,
        customerName: r.userName,
        customerEmail: r.userEmail,
        status: BookingStatus.COMPLETED,
        scheduledStart: new Date(),
        scheduledEnd: new Date(Date.now() + 3600000),
        pricePesewas: 60000,
        depositPesewas: 12000,
        balancePesewas: 48000,
        source: BookingSource.ONLINE,
        completedAt: new Date(),
      }
    });

    // 3. Create Review
    await prisma.review.create({
      data: {
        bookingId: booking.id,
        vendorId: VENDOR_ID,
        customerUserId: user.id,
        rating: r.rating,
        comment: r.comment,
      }
    });

    console.log(`Created review from ${r.userName}`);
  }

  console.log('Done populating test reviews for glamquarters123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
