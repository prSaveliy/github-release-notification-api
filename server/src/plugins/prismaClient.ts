import fp from 'fastify-plugin';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const prismaCLientPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const connectionString = `${fastify.config.DATABASE_URL}`;
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  await prisma.$connect();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};

export default fp(prismaCLientPlugin);