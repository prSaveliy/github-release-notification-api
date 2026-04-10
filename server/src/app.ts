import Fastify, { FastifyRequest, FastifyReply } from 'fastify';

import fastifyEnv from '@fastify/env';

import { envSchema } from './config/index.js';
import { AppError } from './commons/interfaces/AppError.js';

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

  return app;
};

export default buildApp;
