import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';

import fastifyEnv from '@fastify/env';
import fastifyStatic from '@fastify/static';
import fastifySensible from '@fastify/sensible';
import prismaClientPlugin from './plugins/prismaClient.js';
import redisPlugin from './plugins/redis.js';
import mailTransporterPlugin from './plugins/mailTransporter.js';
import scannerPlugin from './plugins/scanner.js';

import subscriptionRoutes from './routes/subscription.routes.js';

import { envSchema } from './config/index.js';
import { AppError } from './commons/interfaces/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const buildApp = async () => {
  const app = Fastify({
    logger: true,
    trustProxy: 1,
  });

  app.setErrorHandler(
    (error: AppError, request: FastifyRequest, reply: FastifyReply) => {
      reply.status(error.statusCode || 500).send({
        message:
          error.statusCode &&
          (error.statusCode < 500)
            ? error.message
            : 'Internal server error',
        details: error.details ?? '',
      });
    },
  );

  // plugins
  await app.register(fastifyEnv, {
    schema: envSchema,
    dotenv: true,
  });
  app.register(fastifySensible);
  app.register(fastifyStatic, {
    root: path.join(__dirname, '../../client'),
    prefix: '/',
  });
  app.register(prismaClientPlugin);
  app.register(redisPlugin);
  app.register(mailTransporterPlugin);
  app.register(scannerPlugin);

  // routes
  app.register(subscriptionRoutes, {
    prefix: '/api',
  });

  return app;
};

export default buildApp;