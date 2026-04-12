import fp from 'fastify-plugin';
import fastifyRedis from '@fastify/redis';

import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const redisPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!fastify.config.REDIS_URL) {
    return;
  }

  await fastify.register(fastifyRedis, {
    url: fastify.config.REDIS_URL,
    closeClient: true,
  });
};

export default fp(redisPlugin);
