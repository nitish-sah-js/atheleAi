import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const federationEmail = process.env.SEED_FEDERATION_EMAIL ?? 'federation@athleteshield.test';
  const federationPassword = process.env.SEED_FEDERATION_PASSWORD ?? 'Federation@123';

  if (!adminEmail || !adminPassword) {
    console.log('Skipping seed: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are not set.');
    return;
  }

  const adminHash = await argon2.hash(adminPassword);
  const federationHash = await argon2.hash(federationPassword);

  await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      roles: [UserRole.ADMIN],
      status: UserStatus.ACTIVE,
      passwordHash: adminHash,
    },
    create: {
      email: adminEmail.toLowerCase(),
      passwordHash: adminHash,
      firstName: 'Platform',
      lastName: 'Admin',
      roles: [UserRole.ADMIN],
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { email: federationEmail.toLowerCase() },
    update: {
      roles: [UserRole.FEDERATION],
      status: UserStatus.ACTIVE,
      passwordHash: federationHash,
    },
    create: {
      email: federationEmail.toLowerCase(),
      passwordHash: federationHash,
      firstName: 'National',
      lastName: 'Federation',
      roles: [UserRole.FEDERATION],
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
