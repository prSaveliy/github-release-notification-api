import fp from 'fastify-plugin';
import nodemailer from 'nodemailer';

import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const mailTransporterPlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  const transporter = nodemailer.createTransport({
    host: fastify.config.SMTP_HOST,
    port: fastify.config.SMTP_PORT,
    secure: false,
    auth: {
      user: fastify.config.SMTP_USER,
      pass: fastify.config.SMTP_PASSWORD,
    },
  });

  fastify.decorate('mailTransporter', transporter);

  fastify.addHook('onClose', async () => {
    transporter.close();
  });
};

export default fp(mailTransporterPlugin);
