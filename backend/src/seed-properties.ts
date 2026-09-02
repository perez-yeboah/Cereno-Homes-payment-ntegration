import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.create({
    data: {
      address: '123 Test Property Avenue, Accra',
      basePrice: 500000,
      currency: 'GHS',
      status: 'AVAILABLE'
    }
  });

  const property1 = await prisma.property.create({
    data: {
      address: '456 Sample Real Estate Blvd, Kumasi',
      basePrice: 350000,
      currency: 'GHS',
      status: 'AVAILABLE'
    }
  });

  console.log(`Created property ${property.id}`);
  console.log(`Created property ${property1.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
