import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set — refusing to wipe database');
}
if (process.env.NODE_ENV !== 'test') {
  throw new Error('Refusing to wipe database: NODE_ENV is not "test"');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

await prisma.$connect();
await prisma.subscription.deleteMany({});
await prisma.$disconnect();
