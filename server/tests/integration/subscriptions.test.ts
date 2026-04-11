import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';

import buildApp from '../../src/app.js';

const email = (tag: string) => `github-release-notification-api+${tag}@gmail.com`;

describe('GET /api/subscriptions', () => {
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

  test('200 — returns confirmed subscriptions for the given email', async () => {
    const to = email('list-confirmed');

    await (app as any).prisma.subscription.createMany({
      data: [
        {
          email: to,
          repo: 'golang/go',
          confirmed: true,
          lastSeenTag: 'v1.22.0',
          confirmationToken: randomUUID(),
          unsubscribeToken: randomUUID(),
        },
        {
          email: to,
          repo: 'nodejs/node',
          confirmed: true,
          lastSeenTag: null,
          confirmationToken: randomUUID(),
          unsubscribeToken: randomUUID(),
        },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/subscriptions?email=${encodeURIComponent(to)}`,
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(Array.isArray(body));
    assert.equal(body.length, 2);

    const byRepo = Object.fromEntries(body.map((s: any) => [s.repo, s]));
    assert.deepEqual(byRepo['golang/go'], {
      email: to,
      repo: 'golang/go',
      confirmed: true,
      last_seen_tag: 'v1.22.0',
    });
    assert.deepEqual(byRepo['nodejs/node'], {
      email: to,
      repo: 'nodejs/node',
      confirmed: true,
      last_seen_tag: null,
    });
  });

  test('200 — excludes unconfirmed subscriptions', async () => {
    const to = email('list-mixed');

    await (app as any).prisma.subscription.createMany({
      data: [
        {
          email: to,
          repo: 'facebook/react',
          confirmed: true,
          confirmationToken: randomUUID(),
          unsubscribeToken: randomUUID(),
        },
        {
          email: to,
          repo: 'vuejs/vue',
          confirmed: false,
          confirmationToken: randomUUID(),
          unsubscribeToken: randomUUID(),
        },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/subscriptions?email=${encodeURIComponent(to)}`,
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.length, 1);
    assert.equal(body[0].repo, 'facebook/react');
  });

  test('200 — returns empty array when email has no subscriptions', async () => {
    const to = email('list-empty');

    const response = await app.inject({
      method: 'GET',
      url: `/api/subscriptions?email=${encodeURIComponent(to)}`,
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), []);
  });

  test('200 — does not return subscriptions belonging to other emails', async () => {
    const mine = email('list-isolated-mine');
    const other = email('list-isolated-other');

    await (app as any).prisma.subscription.createMany({
      data: [
        {
          email: mine,
          repo: 'rust-lang/rust',
          confirmed: true,
          confirmationToken: randomUUID(),
          unsubscribeToken: randomUUID(),
        },
        {
          email: other,
          repo: 'rust-lang/rust',
          confirmed: true,
          confirmationToken: randomUUID(),
          unsubscribeToken: randomUUID(),
        },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/subscriptions?email=${encodeURIComponent(mine)}`,
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.length, 1);
    assert.equal(body[0].email, mine);
  });

  test('400 — rejects invalid email', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/subscriptions?email=not-an-email',
    });

    assert.equal(response.statusCode, 400);
  });

  test('400 — rejects missing email query param', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/subscriptions',
    });

    assert.equal(response.statusCode, 400);
  });
});
