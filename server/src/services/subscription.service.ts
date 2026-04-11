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
        data: { confirmationToken, unsubscribeToken, createdAt: new Date() },
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

  async confirm(fastify: FastifyInstance, token: string): Promise<void> {
    const sub = await fastify.prisma.subscription.findUnique({
      where: { confirmationToken: token },
    });

    if (!sub) {
      throw fastify.httpErrors.notFound('Token not found');
    }

    if (sub.confirmed) {
      // idempotent operation
      return;
    }

    await fastify.prisma.subscription.update({
      where: { id: sub.id },
      data: { confirmed: true },
    });
  }

  async unsubscribe(fastify: FastifyInstance, token: string): Promise<void> {
    const sub = await fastify.prisma.subscription.findUnique({
      where: { unsubscribeToken: token },
    });

    if (!sub) {
      throw fastify.httpErrors.notFound('Token not found');
    }

    await fastify.prisma.subscription.delete({
      where: { id: sub.id },
    });
  }

  async listByEmail(
    fastify: FastifyInstance,
    email: string,
  ): Promise<
    Array<{
      email: string;
      repo: string;
      confirmed: boolean;
      last_seen_tag: string | null;
    }>
  > {
    const rows = await fastify.prisma.subscription.findMany({
      where: { email, confirmed: true },
    });

    return rows.map((r) => ({
      email: r.email,
      repo: r.repo,
      confirmed: r.confirmed,
      last_seen_tag: r.lastSeenTag,
    }));
  }
}

export default new SubscriptionService();
