import { describe, test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';

import buildApp from '../../src/app.js';
import mailService from '../../src/services/mail.service.js';

const REAL_REPO = 'golang/go';

const email = (tag: string) =>
  `github-release-notification-api+cache-${tag}@gmail.com`;

describe('Redis cache integration', () => {
  let app: FastifyInstance;
  let fetchSpy: ReturnType<typeof mock.method>;
  const originalFetch = globalThis.fetch;

  before(async () => {
    if (!process.env.REDIS_URL) {
      return;
    }
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Refusing to run: NODE_ENV is not "test"');
    }
    mock.method(mailService, 'sendConfirmationEmail', async () => {});
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    if (!(app as any).redis) return;
    await (app as any).redis.flushdb();
    if (fetchSpy) {
      fetchSpy.mock.restore();
    }
  });

  after(async () => {
    mock.restoreAll();
    if (app) await app.close();
  });

  test('skip: REDIS_URL not set', { skip: !process.env.REDIS_URL }, () => {});

  test(
    'second subscribe to the same repo is served from cache',
    { skip: !process.env.REDIS_URL },
    async () => {
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/subscribe',
        payload: { email: email('cache-hit-1'), repo: REAL_REPO },
      });
      assert.equal(res1.statusCode, 200);

      fetchSpy = mock.method(globalThis, 'fetch', originalFetch);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/subscribe',
        payload: { email: email('cache-hit-2'), repo: REAL_REPO },
      });
      assert.equal(res2.statusCode, 200);

      const githubCalls = fetchSpy.mock.calls.filter((c: any) =>
        String(c.arguments[0]).includes('api.github.com/repos/'),
      );
      assert.equal(
        githubCalls.length,
        0,
        'second subscribe should not call GitHub API (cache hit)',
      );
    },
  );

  test(
    'cache expires after TTL and re-fetches from GitHub',
    { skip: !process.env.REDIS_URL },
    async () => {
      const key = `gh:repo:${REAL_REPO}`;
      await (app as any).redis.set(key, JSON.stringify({ ok: true }), 'EX', 1);

      fetchSpy = mock.method(globalThis, 'fetch', originalFetch);

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/subscribe',
        payload: { email: email('ttl-1'), repo: REAL_REPO },
      });
      assert.equal(res1.statusCode, 200);

      const callsDuringCacheHit = fetchSpy.mock.calls.filter((c: any) =>
        String(c.arguments[0]).includes('api.github.com/repos/golang/go'),
      );
      assert.equal(callsDuringCacheHit.length, 0, 'should be a cache hit');

      fetchSpy.mock.restore();

      await new Promise((r) => setTimeout(r, 1100));

      fetchSpy = mock.method(globalThis, 'fetch', originalFetch);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/subscribe',
        payload: { email: email('ttl-2'), repo: REAL_REPO },
      });
      assert.equal(res2.statusCode, 200);

      const callsAfterExpiry = fetchSpy.mock.calls.filter((c: any) =>
        String(c.arguments[0]).includes('api.github.com/repos/golang/go'),
      );
      assert.equal(
        callsAfterExpiry.length,
        1,
        'should re-fetch from GitHub after TTL expires',
      );
    },
  );

  test(
    'errors are not cached — 404 repo can succeed after becoming available',
    { skip: !process.env.REDIS_URL },
    async () => {
      const fakeRepo = 'nonexistent-owner-xyz/nonexistent-repo-abc';

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/subscribe',
        payload: { email: email('err-cache-1'), repo: fakeRepo },
      });
      assert.equal(res1.statusCode, 404);

      const cached = await (app as any).redis.get(`gh:repo:${fakeRepo}`);
      assert.equal(cached, null, '404 response should not be cached');
    },
  );

  test(
    'different repos get separate cache entries',
    { skip: !process.env.REDIS_URL },
    async () => {
      const repo1 = 'golang/go';
      const repo2 = 'nodejs/node';

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/subscribe',
        payload: { email: email('sep-1'), repo: repo1 },
      });
      assert.equal(res1.statusCode, 200);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/subscribe',
        payload: { email: email('sep-2'), repo: repo2 },
      });
      assert.equal(res2.statusCode, 200);

      const cached1 = await (app as any).redis.get(`gh:repo:${repo1}`);
      const cached2 = await (app as any).redis.get(`gh:repo:${repo2}`);
      assert.ok(cached1, 'repo1 should be cached');
      assert.ok(cached2, 'repo2 should be cached');
      assert.equal(
        cached1,
        cached2,
        'both should cache the same sentinel value',
      );
    },
  );
});
