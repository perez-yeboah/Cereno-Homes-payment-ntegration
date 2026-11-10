import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'info@cerenohomesghana.com';
  const password = process.env.ADMIN_PASSWORD || 'password123';
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const user = await prisma.adminUser.upsert({
    where: { email },
    update: {
      password: hashedPassword
    },
    create: {
      email,
      password: hashedPassword,
      name: 'System Admin',
      role: 'SUPERADMIN'
    }
  });

  console.log(`Successfully synced admin user:`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
