import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';

import githubService from './github.service.js';
import mailService from './mail.service.js';

class SubscriptionService {
  async subscribe(
    fastify: FastifyInstance,
    email: string,
    repo: string,
  ): Promise<void> {
    const [owner, name] = repo.split('/');

    await githubService.verifyRepo(fastify, owner, name);

    const existing = await fastify.prisma.subscription.findUnique({
      where: { email_repo: { email, repo } },
    });

    if (existing?.confirmed) {
      throw fastify.httpErrors.conflict(
        'Email already subscribed to this repository',
      );
    }

    const confirmationToken = randomUUID();
    const unsubscribeToken = randomUUID();

    if (existing) {
      await fastify.prisma.subscription.update({
        where: { email_repo: { email, repo } },
        data: { confirmationToken, unsubscribeToken },
      });
    } else {
      await fastify.prisma.subscription.create({
        data: { email, repo, confirmationToken, unsubscribeToken },
      });
    }

    await mailService.sendConfirmationEmail(
      fastify,
      email,
      repo,
      confirmationToken,
    );
  }
}

export default new SubscriptionService();
