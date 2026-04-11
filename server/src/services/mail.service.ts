import { FastifyInstance } from 'fastify';

import { LatestRelease } from '../commons/interfaces/LatestRelease.js';

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

  async sendReleaseNotification(
    fastify: FastifyInstance,
    email: string,
    repo: string,
    release: LatestRelease,
    unsubscribeToken: string,
  ): Promise<void> {
    const unsubscribeUrl = `${fastify.config.API_URL}/api/unsubscribe/${unsubscribeToken}`;

    await fastify.mailTransporter.sendMail({
      from: fastify.config.SMTP_USER,
      to: email,
      subject: `New release: ${repo} ${release.tagName}`,
      text:
        `${repo} just published ${release.tagName}.\n` +
        `Published at: ${release.publishedAt}\n` +
        `Release page: ${release.htmlUrl}\n\n` +
        `Unsubscribe: ${unsubscribeUrl}`,
      html: `
        <div>
          <h1>${repo} ${release.tagName}</h1>
          <p>A new release has been published.</p>
          <ul>
            <li>Published at: ${release.publishedAt}</li>
            <li><a href="${release.htmlUrl}">View the release on GitHub</a></li>
          </ul>
          <p>
            <a href="${unsubscribeUrl}">Unsubscribe</a> from ${repo} release notifications.
          </p>
        </div>
      `,
    });
  }
}

export default new MailService();
