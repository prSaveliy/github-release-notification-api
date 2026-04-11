import 'fastify';
import { HttpErrors } from '@fastify/sensible';

import { PrismaClient } from '../../../generated/prisma/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: number;
      DATABASE_URL: string;
      GITHUB_TOKEN?: string;
    };
    httpErrors: HttpErrors;
    prisma: PrismaClient;
  }
}
