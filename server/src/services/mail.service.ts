import { FastifyInstance } from 'fastify';

class MailService {
  async sendConfirmationEmail(
    fastify: FastifyInstance,
    email: string,
    repo: string,
    token: string,
  ): Promise<void> {
    const confirmUrl = `${fastify.config.API_URL}/api/confirm/${token}`;

    await fastify.mailTransporter.sendMail({
      from: fastify.config.SMTP_USER,
      to: email,
      subject: `Confirm your subscription to ${repo} releases`,
      text: `Confirm your subscription: ${confirmUrl}`,
      html: `
        <div>
          <h1>Confirm your subscription to ${repo} releases</h1>
          <p><a href="${confirmUrl}">Click here to confirm</a></p>
        </div>
      `,
    });
  }
}

export default new MailService();
