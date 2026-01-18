import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const services = await prisma.service.findMany({
    where: {
      images: {
        none: {},
      },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
      vendorId: true,
    },
  });

  console.log('Services missing images:');
  console.log(JSON.stringify(services, null, 2));
  console.log(`\nTotal: ${services.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
