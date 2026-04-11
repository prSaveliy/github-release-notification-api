import { FastifyInstance } from 'fastify';

import githubService from './github.service.js';
import mailService from './mail.service.js';
import { AppError } from '../commons/interfaces/AppError.js';

class ScannerService {
  async runScanCycle(fastify: FastifyInstance): Promise<void> {
    const repos = await fastify.prisma.subscription.findMany({
      where: { confirmed: true },
      distinct: ['repo'],
      select: { repo: true },
    });

    fastify.log.info(
      { repoCount: repos.length },
      'scan cycle starting',
    );

    for (const { repo } of repos) {
      const [owner, name] = repo.split('/');

      let latest;
      try {
        latest = await githubService.getLatestRelease(fastify, owner, name);
      } catch (err) {
        if ((err as AppError).statusCode === 429) {
          fastify.log.warn(
            { err },
            'GitHub rate limit - aborting scan cycle',
          );
          return;
        }
        fastify.log.warn({ err, repo }, 'failed to fetch latest release');
        continue;
      }

      if (!latest) {
        fastify.log.debug({ repo }, 'no latest release available, skipping');
        continue;
      }

      const subs = await fastify.prisma.subscription.findMany({
        where: { repo, confirmed: true },
      });

      for (const sub of subs) {
        if (sub.lastSeenTag === latest.tagName) {
          continue;
        }

        if (new Date(latest.publishedAt) < sub.createdAt) {
          // release predates the subscription — mark as seen without notifying
          await fastify.prisma.subscription.update({
            where: { id: sub.id },
            data: { lastSeenTag: latest.tagName },
          });
          continue;
        }

        try {
          await mailService.sendReleaseNotification(
            fastify,
            sub.email,
            sub.repo,
            latest,
            sub.unsubscribeToken,
          );
        } catch (err) {
          fastify.log.error(
            { err, repo, email: sub.email },
            'failed to send release notification',
          );
          continue;
        }

        await fastify.prisma.subscription.update({
          where: { id: sub.id },
          data: { lastSeenTag: latest.tagName },
        });
      }
    }

    fastify.log.info('scan cycle finished');
  }
}

export default new ScannerService();
