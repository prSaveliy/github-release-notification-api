import { describe, test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import scannerService from '../../src/services/scanner.service.js';
import githubService from '../../src/services/github.service.js';
import mailService from '../../src/services/mail.service.js';

type FakeSub = {
  id: string;
  email: string;
  repo: string;
  confirmed: boolean;
  lastSeenTag: string | null;
  unsubscribeToken: string;
  createdAt: Date;
};

// Release fixture publishedAt — tests below pick createdAt relative to this.
const RELEASE_PUBLISHED_AT = '2026-04-10T00:00:00Z';
const BEFORE_RELEASE = new Date('2026-04-05T00:00:00Z');
const AFTER_RELEASE = new Date('2026-04-11T00:00:00Z');

const makeFastify = (subs: FakeSub[]) => {
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];

  const findMany = mock.fn(async (args: any) => {
    if (args?.distinct) {
      // distinct repos projection
      const seen = new Set<string>();
      const repos: Array<{ repo: string }> = [];
      for (const s of subs) {
        if (!s.confirmed) continue;
        if (!seen.has(s.repo)) {
          seen.add(s.repo);
          repos.push({ repo: s.repo });
        }
      }
      return repos;
    }
    // per-repo fetch
    return subs.filter(
      (s) => s.confirmed && s.repo === args.where.repo,
    );
  });

  const update = mock.fn(async (args: any) => {
    updates.push({ id: args.where.id, data: args.data });
    const sub = subs.find((s) => s.id === args.where.id);
    if (sub && typeof args.data.lastSeenTag === 'string') {
      sub.lastSeenTag = args.data.lastSeenTag;
    }
    return sub;
  });

  const fastify = {
    log: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
    prisma: {
      subscription: { findMany, update },
    },
  };

  return { fastify, updates, findMany, update };
};

const latest = (tagName: string) => ({
  tagName,
  htmlUrl: `https://github.com/x/y/releases/tag/${tagName}`,
  publishedAt: RELEASE_PUBLISHED_AT,
});

describe('scannerService.runScanCycle()', () => {
  afterEach(() => mock.restoreAll());

  test('skips release older than the subscription and marks it as seen', async () => {
    const subs: FakeSub[] = [
      {
        id: '1',
        email: 'a@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: null,
        unsubscribeToken: 'tok-1',
        createdAt: AFTER_RELEASE,
      },
    ];
    const { fastify, updates } = makeFastify(subs);

    mock.method(githubService, 'getLatestRelease', async () => latest('v1.0.0'));
    const sendMock = mock.method(
      mailService,
      'sendReleaseNotification',
      async () => {},
    );

    await scannerService.runScanCycle(fastify as any);

    assert.equal(sendMock.mock.callCount(), 0);
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0], { id: '1', data: { lastSeenTag: 'v1.0.0' } });
  });

  test('sends email on first scan when release is newer than the subscription', async () => {
    const subs: FakeSub[] = [
      {
        id: '1',
        email: 'a@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: null,
        unsubscribeToken: 'tok-1',
        createdAt: BEFORE_RELEASE,
      },
    ];
    const { fastify, updates } = makeFastify(subs);

    mock.method(githubService, 'getLatestRelease', async () => latest('v1.0.0'));
    const sendMock = mock.method(
      mailService,
      'sendReleaseNotification',
      async () => {},
    );

    await scannerService.runScanCycle(fastify as any);

    assert.equal(sendMock.mock.callCount(), 1);
    const [, emailArg, repoArg, releaseArg, tokenArg] =
      sendMock.mock.calls[0].arguments;
    assert.equal(emailArg, 'a@example.com');
    assert.equal(repoArg, 'owner/repo');
    assert.equal((releaseArg as any).tagName, 'v1.0.0');
    assert.equal(tokenArg, 'tok-1');

    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0], { id: '1', data: { lastSeenTag: 'v1.0.0' } });
  });

  test('sends email and updates tag when lastSeenTag differs', async () => {
    const subs: FakeSub[] = [
      {
        id: '1',
        email: 'a@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: 'v0.9.0',
        unsubscribeToken: 'tok-1',
        createdAt: BEFORE_RELEASE,
      },
    ];
    const { fastify, updates } = makeFastify(subs);

    mock.method(githubService, 'getLatestRelease', async () => latest('v1.0.0'));
    const sendMock = mock.method(
      mailService,
      'sendReleaseNotification',
      async () => {},
    );

    await scannerService.runScanCycle(fastify as any);

    assert.equal(sendMock.mock.callCount(), 1);
    const [, emailArg, repoArg, releaseArg, tokenArg] =
      sendMock.mock.calls[0].arguments;
    assert.equal(emailArg, 'a@example.com');
    assert.equal(repoArg, 'owner/repo');
    assert.equal((releaseArg as any).tagName, 'v1.0.0');
    assert.equal(tokenArg, 'tok-1');

    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0], { id: '1', data: { lastSeenTag: 'v1.0.0' } });
  });

  test('no-op when lastSeenTag equals the latest tag', async () => {
    const subs: FakeSub[] = [
      {
        id: '1',
        email: 'a@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: 'v1.0.0',
        unsubscribeToken: 'tok-1',
        createdAt: BEFORE_RELEASE,
      },
    ];
    const { fastify, updates } = makeFastify(subs);

    mock.method(githubService, 'getLatestRelease', async () => latest('v1.0.0'));
    const sendMock = mock.method(
      mailService,
      'sendReleaseNotification',
      async () => {},
    );

    await scannerService.runScanCycle(fastify as any);

    assert.equal(sendMock.mock.callCount(), 0);
    assert.equal(updates.length, 0);
  });

  test('two subscribers to the same repo share a single GitHub call', async () => {
    const subs: FakeSub[] = [
      {
        id: '1',
        email: 'a@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: 'v0.9.0',
        unsubscribeToken: 'tok-1',
        createdAt: BEFORE_RELEASE,
      },
      {
        id: '2',
        email: 'b@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: 'v0.9.0',
        unsubscribeToken: 'tok-2',
        createdAt: BEFORE_RELEASE,
      },
    ];
    const { fastify, updates } = makeFastify(subs);

    const ghMock = mock.method(
      githubService,
      'getLatestRelease',
      async () => latest('v1.0.0'),
    );
    const sendMock = mock.method(
      mailService,
      'sendReleaseNotification',
      async () => {},
    );

    await scannerService.runScanCycle(fastify as any);

    assert.equal(ghMock.mock.callCount(), 1);
    assert.equal(sendMock.mock.callCount(), 2);
    assert.equal(updates.length, 2);
  });

  test('null from getLatestRelease skips repo without emailing or updating', async () => {
    const subs: FakeSub[] = [
      {
        id: '1',
        email: 'a@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: 'v0.9.0',
        unsubscribeToken: 'tok-1',
        createdAt: BEFORE_RELEASE,
      },
    ];
    const { fastify, updates } = makeFastify(subs);

    mock.method(githubService, 'getLatestRelease', async () => null);
    const sendMock = mock.method(
      mailService,
      'sendReleaseNotification',
      async () => {},
    );

    await scannerService.runScanCycle(fastify as any);

    assert.equal(sendMock.mock.callCount(), 0);
    assert.equal(updates.length, 0);
  });

  test('429 error aborts the cycle, no further repos processed', async () => {
    const subs: FakeSub[] = [
      {
        id: '1',
        email: 'a@example.com',
        repo: 'owner/repo1',
        confirmed: true,
        lastSeenTag: 'v0.9.0',
        unsubscribeToken: 'tok-1',
        createdAt: BEFORE_RELEASE,
      },
      {
        id: '2',
        email: 'b@example.com',
        repo: 'owner/repo2',
        confirmed: true,
        lastSeenTag: 'v0.9.0',
        unsubscribeToken: 'tok-2',
        createdAt: BEFORE_RELEASE,
      },
    ];
    const { fastify, updates } = makeFastify(subs);

    const ghMock = mock.method(
      githubService,
      'getLatestRelease',
      async () => {
        const err: Error & { statusCode?: number } = new Error('rate limited');
        err.statusCode = 429;
        throw err;
      },
    );
    const sendMock = mock.method(
      mailService,
      'sendReleaseNotification',
      async () => {},
    );

    await scannerService.runScanCycle(fastify as any);

    assert.equal(ghMock.mock.callCount(), 1);
    assert.equal(sendMock.mock.callCount(), 0);
    assert.equal(updates.length, 0);
  });

  test('non-429 error for one repo continues to the next repo', async () => {
    const subs: FakeSub[] = [
      {
        id: '1',
        email: 'a@example.com',
        repo: 'owner/repo1',
        confirmed: true,
        lastSeenTag: 'v0.9.0',
        unsubscribeToken: 'tok-1',
        createdAt: BEFORE_RELEASE,
      },
      {
        id: '2',
        email: 'b@example.com',
        repo: 'owner/repo2',
        confirmed: true,
        lastSeenTag: 'v0.9.0',
        unsubscribeToken: 'tok-2',
        createdAt: BEFORE_RELEASE,
      },
    ];
    const { fastify, updates } = makeFastify(subs);

    const ghMock = mock.method(
      githubService,
      'getLatestRelease',
      async (_f: any, owner: string, name: string) => {
        if (`${owner}/${name}` === 'owner/repo1') {
          throw new Error('boom');
        }
        return latest('v1.0.0');
      },
    );
    const sendMock = mock.method(
      mailService,
      'sendReleaseNotification',
      async () => {},
    );

    await scannerService.runScanCycle(fastify as any);

    assert.equal(ghMock.mock.callCount(), 2);
    assert.equal(sendMock.mock.callCount(), 1);
    const [, , repoArg] = sendMock.mock.calls[0].arguments;
    assert.equal(repoArg, 'owner/repo2');
    assert.equal(updates.length, 1);
    assert.equal(updates[0].id, '2');
  });

  test('only scans confirmed subscriptions', async () => {
    const subs: FakeSub[] = [
      {
        id: '1',
        email: 'a@example.com',
        repo: 'owner/unconfirmed',
        confirmed: false,
        lastSeenTag: 'v0.9.0',
        unsubscribeToken: 'tok-1',
        createdAt: BEFORE_RELEASE,
      },
    ];
    const { fastify } = makeFastify(subs);

    const ghMock = mock.method(
      githubService,
      'getLatestRelease',
      async () => latest('v1.0.0'),
    );
    const sendMock = mock.method(
      mailService,
      'sendReleaseNotification',
      async () => {},
    );

    await scannerService.runScanCycle(fastify as any);

    assert.equal(ghMock.mock.callCount(), 0);
    assert.equal(sendMock.mock.callCount(), 0);
  });
});
