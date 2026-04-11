import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';

import buildApp from '../../src/app.js';

const REPO = 'golang/go';

const email = (tag: string) => `github-release-notification-api+${tag}@gmail.com`;

describe('GET /api/unsubscribe/:token', () => {
  let app: FastifyInstance;

  before(async () => {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Refusing to wipe database: NODE_ENV is not "test"');
    }
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('200 — deletes a confirmed subscription', async () => {
    const to = email('unsub-confirmed');
    const unsubscribeToken = randomUUID();

    await (app as any).prisma.subscription.create({
      data: {
        email: to,
        repo: REPO,
        confirmed: true,
        confirmationToken: randomUUID(),
        unsubscribeToken,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/unsubscribe/${unsubscribeToken}`,
    });

    assert.equal(response.statusCode, 200);

    const sub = await (app as any).prisma.subscription.findUnique({
      where: { unsubscribeToken },
    });
    assert.equal(sub, null);
  });

  test('200 — deletes a pending subscription', async () => {
    const to = email('unsub-pending');
    const unsubscribeToken = randomUUID();

    await (app as any).prisma.subscription.create({
      data: {
        email: to,
        repo: REPO,
        confirmed: false,
        confirmationToken: randomUUID(),
        unsubscribeToken,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/unsubscribe/${unsubscribeToken}`,
    });

    assert.equal(response.statusCode, 200);

    const sub = await (app as any).prisma.subscription.findUnique({
      where: { unsubscribeToken },
    });
    assert.equal(sub, null);
  });

  test('400 — rejects non-UUID token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/unsubscribe/not-a-uuid',
    });

    assert.equal(response.statusCode, 400);
  });

  test('404 — returns not found for unknown token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/unsubscribe/${randomUUID()}`,
    });

    assert.equal(response.statusCode, 404);
  });
});
