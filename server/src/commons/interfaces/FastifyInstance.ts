import 'fastify';
import { HttpErrors } from '@fastify/sensible';
import { Transporter } from 'nodemailer';

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
    };
    httpErrors: HttpErrors;
    prisma: PrismaClient;
    mailTransporter: Transporter;
  }
}