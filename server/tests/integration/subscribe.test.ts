import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';

import buildApp from '../../src/app.js';

const REAL_REPO = 'golang/go';
const MISSING_REPO = 'this-owner-does-not-exist-xyz-9f2a1b/nope-repo-8c7d3e';

const email = (tag: string) => `github-release-notification-api+${tag}@gmail.com`;

describe('POST /api/subscribe', () => {
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

  test('200 — creates pending subscription and sends confirmation email', async () => {
    const to = email('create');

    const response = await app.inject({
      method: 'POST',
      url: '/api/subscribe',
      payload: { email: to, repo: REAL_REPO },
    });

    assert.equal(response.statusCode, 200);

    const sub = await (app as any).prisma.subscription.findUnique({
      where: { email_repo: { email: to, repo: REAL_REPO } },
    });
    assert.ok(sub, 'subscription row should exist');
    assert.equal(sub.confirmed, false);
    assert.ok(sub.confirmationToken, 'confirmationToken should be set');
    assert.ok(sub.unsubscribeToken, 'unsubscribeToken should be set');
  });

  test('200 — resends email and refreshes tokens for unconfirmed duplicate', async () => {
    const to = email('resend');

    await app.inject({
      method: 'POST',
      url: '/api/subscribe',
      payload: { email: to, repo: REAL_REPO },
    });

    const firstSub = await (app as any).prisma.subscription.findUnique({
      where: { email_repo: { email: to, repo: REAL_REPO } },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/subscribe',
      payload: { email: to, repo: REAL_REPO },
    });

    assert.equal(response.statusCode, 200);

    const secondSub = await (app as any).prisma.subscription.findUnique({
      where: { email_repo: { email: to, repo: REAL_REPO } },
    });
    assert.equal(secondSub.confirmed, false);
    assert.notEqual(
      secondSub.confirmationToken,
      firstSub.confirmationToken,
      'confirmation token should be refreshed on resend',
    );
    assert.notEqual(
      secondSub.unsubscribeToken,
      firstSub.unsubscribeToken,
      'unsubscribe token should be refreshed on resend',
    );
  });

  test('409 — returns conflict when email is already confirmed for the repo', async () => {
    const to = email('confirmed');

    await (app as any).prisma.subscription.create({
      data: {
        email: to,
        repo: REAL_REPO,
        confirmed: true,
        confirmationToken: randomUUID(),
        unsubscribeToken: randomUUID(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/subscribe',
      payload: { email: to, repo: REAL_REPO },
    });

    assert.equal(response.statusCode, 409);
  });

  test('400 — rejects invalid email format', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/subscribe',
      payload: { email: 'not-an-email', repo: REAL_REPO },
    });

    assert.equal(response.statusCode, 400);
  });

  test('400 — rejects invalid repo format', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/subscribe',
      payload: { email: email('bad-repo'), repo: 'not-valid-repo' },
    });

    assert.equal(response.statusCode, 400);
  });

  test('400 — rejects missing fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/subscribe',
      payload: { email: email('missing') },
    });

    assert.equal(response.statusCode, 400);
  });

  test('404 — returns not found when GitHub repo does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/subscribe',
      payload: { email: email('missing-repo'), repo: MISSING_REPO },
    });

    assert.equal(response.statusCode, 404);
  });
});
