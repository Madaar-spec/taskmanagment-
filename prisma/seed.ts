import { PrismaClient } from '@prisma/client';
import { seed, SEED_PASSWORD, USERS } from './seedData';

const prisma = new PrismaClient();

seed(prisma)
  .then(() => {
    console.log('✔ Seed complete. Accounts (password: %s):', SEED_PASSWORD);
    for (const u of Object.values(USERS)) console.log(`  ${u.role.padEnd(8)} ${u.email}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
