
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const vendor = await prisma.vendor.findUnique({
    where: { handle: 'glamquarters123' },
    include: {
      services: {
        take: 1,
      },
    },
  });

  if (!vendor) {
    console.error('Vendor glamquarters123 not found');
    process.exit(1);
  }

  console.log(JSON.stringify(vendor, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
