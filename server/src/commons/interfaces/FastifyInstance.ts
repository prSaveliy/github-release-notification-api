import 'fastify';
import { HttpErrors } from '@fastify/sensible';
import { Transporter } from 'nodemailer';
import type { ToadScheduler } from 'toad-scheduler';
import type { Redis } from 'ioredis';

import { PrismaClient } from '../../../generated/prisma/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: number;
      API_URL: string;
      DATABASE_URL: string;
      GITHUB_TOKEN?: string;
      SMTP_HOST: string;
      SMTP_PORT: number;
      SMTP_USER: string;
      SMTP_PASSWORD: string;
      SCAN_INTERVAL_MS: number;
      SCAN_ENABLED: boolean;
      REDIS_URL: string;
      GITHUB_CACHE_TTL_SECONDS: number;
    };
    httpErrors: HttpErrors;
    prisma: PrismaClient;
    mailTransporter: Transporter;
    scheduler: ToadScheduler;
    redis: Redis;
  }
}