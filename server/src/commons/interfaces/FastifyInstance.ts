import 'fastify';
import { HttpErrors } from '@fastify/sensible';

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: number;
    };
    httpErrors: HttpErrors;
  }
}
