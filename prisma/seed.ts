import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('Skipping seed: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are not set.');
    return;
  }

  const passwordHash = await argon2.hash(password);

  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {
      roles: [UserRole.ADMIN],
      status: UserStatus.ACTIVE,
      passwordHash,
    },
    create: {
      email: email.toLowerCase(),
      passwordHash,
      firstName: 'Platform',
      lastName: 'Admin',
      roles: [UserRole.ADMIN],
      status: UserStatus.ACTIVE,
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
