import { describe, test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import subscriptionService from '../../src/services/subscription.service.js';
import githubService from '../../src/services/github.service.js';
import mailService from '../../src/services/mail.service.js';

const makeFastify = () => ({
  httpErrors: {
    conflict: (msg: string) =>
      Object.assign(new Error(msg), { statusCode: 409 }),
    notFound: (msg: string) =>
      Object.assign(new Error(msg), { statusCode: 404 }),
  },
  prisma: {
    subscription: {
      findUnique: mock.fn(async (_args: any): Promise<any> => null),
      create: mock.fn(async (_args: any): Promise<any> => null),
      update: mock.fn(async (_args: any): Promise<any> => null),
    },
  },
});

describe('subscriptionService.subscribe()', () => {
  afterEach(() => mock.restoreAll());

  test('creates a new subscription when none exists', async () => {
    const fastify = makeFastify();
    fastify.prisma.subscription.findUnique.mock.mockImplementation(
      async () => null,
    );
    fastify.prisma.subscription.create.mock.mockImplementation(async () => ({
      id: 1,
    }));
    mock.method(githubService, 'verifyRepo', async () => {});
    mock.method(mailService, 'sendConfirmationEmail', async () => {});

    await subscriptionService.subscribe(
      fastify as any,
      'user@example.com',
      'owner/repo',
    );

    assert.equal(fastify.prisma.subscription.create.mock.callCount(), 1);
    assert.equal(fastify.prisma.subscription.update.mock.callCount(), 0);

    const { data } =
      fastify.prisma.subscription.create.mock.calls[0].arguments[0];
    assert.equal(data.email, 'user@example.com');
    assert.equal(data.repo, 'owner/repo');
    assert.ok(
      typeof data.confirmationToken === 'string' &&
        data.confirmationToken.length > 0,
    );
    assert.ok(
      typeof data.unsubscribeToken === 'string' &&
        data.unsubscribeToken.length > 0,
    );
  });

  test('updates tokens when an unconfirmed subscription already exists', async () => {
    const fastify = makeFastify();
    fastify.prisma.subscription.findUnique.mock.mockImplementation(
      async () => ({
        id: 1,
        email: 'user@example.com',
        repo: 'owner/repo',
        confirmed: false,
      }),
    );
    fastify.prisma.subscription.update.mock.mockImplementation(async () => ({
      id: 1,
    }));
    mock.method(githubService, 'verifyRepo', async () => {});
    mock.method(mailService, 'sendConfirmationEmail', async () => {});

    await subscriptionService.subscribe(
      fastify as any,
      'user@example.com',
      'owner/repo',
    );

    assert.equal(fastify.prisma.subscription.update.mock.callCount(), 1);
    assert.equal(fastify.prisma.subscription.create.mock.callCount(), 0);

    const { data } =
      fastify.prisma.subscription.update.mock.calls[0].arguments[0];
    assert.ok(
      typeof data.confirmationToken === 'string' &&
        data.confirmationToken.length > 0,
    );
    assert.ok(
      typeof data.unsubscribeToken === 'string' &&
        data.unsubscribeToken.length > 0,
    );
  });

  test('sends confirmation email with the token that was stored in the DB', async () => {
    const fastify = makeFastify();
    fastify.prisma.subscription.findUnique.mock.mockImplementation(
      async () => null,
    );
    fastify.prisma.subscription.create.mock.mockImplementation(async () => ({
      id: 1,
    }));
    mock.method(githubService, 'verifyRepo', async () => {});
    const sendMock = mock.method(
      mailService,
      'sendConfirmationEmail',
      async () => {},
    );

    await subscriptionService.subscribe(
      fastify as any,
      'user@example.com',
      'owner/repo',
    );

    assert.equal(sendMock.mock.callCount(), 1);
    const [, emailArg, repoArg, tokenArg] = sendMock.mock.calls[0].arguments;
    assert.equal(emailArg, 'user@example.com');
    assert.equal(repoArg, 'owner/repo');

    const { data } =
      fastify.prisma.subscription.create.mock.calls[0].arguments[0];
    assert.equal(
      tokenArg,
      data.confirmationToken,
      'email token must match the token stored in DB',
    );
  });

  test('throws 409 when subscription is already confirmed', async () => {
    const fastify = makeFastify();
    fastify.prisma.subscription.findUnique.mock.mockImplementation(
      async () => ({
        id: 1,
        email: 'user@example.com',
        repo: 'owner/repo',
        confirmed: true,
      }),
    );
    mock.method(githubService, 'verifyRepo', async () => {});
    mock.method(mailService, 'sendConfirmationEmail', async () => {});

    await assert.rejects(
      () =>
        subscriptionService.subscribe(
          fastify as any,
          'user@example.com',
          'owner/repo',
        ),
      (err: any) => {
        assert.equal(err.statusCode, 409);
        return true;
      },
    );

    assert.equal(fastify.prisma.subscription.create.mock.callCount(), 0);
    assert.equal(fastify.prisma.subscription.update.mock.callCount(), 0);
  });

  test('propagates verifyRepo error without touching the database', async () => {
    const fastify = makeFastify();
    const notFoundError = Object.assign(
      new Error('Repository not found on GitHub'),
      { statusCode: 404 },
    );
    mock.method(githubService, 'verifyRepo', async () => {
      throw notFoundError;
    });
    mock.method(mailService, 'sendConfirmationEmail', async () => {});

    await assert.rejects(
      () =>
        subscriptionService.subscribe(
          fastify as any,
          'user@example.com',
          'owner/missing',
        ),
      (err: any) => {
        assert.equal(err.statusCode, 404);
        return true;
      },
    );

    assert.equal(fastify.prisma.subscription.findUnique.mock.callCount(), 0);
    assert.equal(fastify.prisma.subscription.create.mock.callCount(), 0);
  });

  test('splits repo string and passes owner + name separately to verifyRepo', async () => {
    const fastify = makeFastify();
    fastify.prisma.subscription.findUnique.mock.mockImplementation(
      async () => null,
    );
    fastify.prisma.subscription.create.mock.mockImplementation(async () => ({
      id: 1,
    }));
    const verifyMock = mock.method(githubService, 'verifyRepo', async () => {});
    mock.method(mailService, 'sendConfirmationEmail', async () => {});

    await subscriptionService.subscribe(
      fastify as any,
      'user@example.com',
      'myorg/myrepo',
    );

    assert.equal(verifyMock.mock.callCount(), 1);
    const [, owner, name] = verifyMock.mock.calls[0].arguments;
    assert.equal(owner, 'myorg');
    assert.equal(name, 'myrepo');
  });
});
