import Fastify from 'fastify';

import fastifyEnv from '@fastify/env';

import { envSchema } from './config/index.js';

const buildApp = async () => {
  const app = Fastify({
    logger: true,
    trustProxy: 1,
  });

  // plugins
  await app.register(fastifyEnv, {
    schema: envSchema,
    dotenv: true,
  });

  return app;
};

export default buildApp;
