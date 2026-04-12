import { describe, test, mock } from 'node:test';
import assert from 'node:assert/strict';

import { withCache } from '../../src/services/githubCache.js';

const makeRedis = () => ({
  get: mock.fn<(key: string) => Promise<string | null>>(async () => null),
  set: mock.fn<
    (key: string, value: string, flag: string, ttl: number) => Promise<void>
  >(async () => {}),
});

const makeFastify = (redis?: ReturnType<typeof makeRedis>) =>
  ({
    redis,
    log: {
      debug: () => {},
      warn: () => {},
    },
  }) as any;

describe('withCache()', () => {
  test('returns parsed value on cache hit and does not call fn', async () => {
    const redis = makeRedis();
    redis.get.mock.mockImplementation(async () => JSON.stringify({ v: 42 }));
    const fn = mock.fn(async () => ({ v: 99 }));

    const result = await withCache(makeFastify(redis), 'key', 600, fn);

    assert.deepEqual(result, { v: 42 });
    assert.equal(fn.mock.callCount(), 0);
    assert.equal(redis.set.mock.callCount(), 0);
  });

  test('calls fn on cache miss, stores result with correct TTL, returns value', async () => {
    const redis = makeRedis();
    const fn = mock.fn(async () => ({ data: 'fresh' }));

    const result = await withCache(makeFastify(redis), 'mykey', 300, fn);

    assert.deepEqual(result, { data: 'fresh' });
    assert.equal(fn.mock.callCount(), 1);
    assert.equal(redis.set.mock.callCount(), 1);
    const setArgs = redis.set.mock.calls[0].arguments;
    assert.equal(setArgs[0], 'mykey');
    assert.equal(setArgs[1], JSON.stringify({ data: 'fresh' }));
    assert.equal(setArgs[2], 'EX');
    assert.equal(setArgs[3], 300);
  });

  test('passes through to fn when redis is undefined', async () => {
    const fn = mock.fn(async () => 'value');

    const result = await withCache(makeFastify(undefined), 'key', 600, fn);

    assert.equal(result, 'value');
    assert.equal(fn.mock.callCount(), 1);
  });

  test('falls through to fn when redis.get throws', async () => {
    const redis = makeRedis();
    redis.get.mock.mockImplementation(async () => {
      throw new Error('connection refused');
    });
    const fn = mock.fn(async () => 'fallback');

    const result = await withCache(makeFastify(redis), 'key', 600, fn);

    assert.equal(result, 'fallback');
    assert.equal(fn.mock.callCount(), 1);
    assert.equal(redis.set.mock.callCount(), 1);
  });

  test('returns value even when redis.set throws', async () => {
    const redis = makeRedis();
    redis.set.mock.mockImplementation(async () => {
      throw new Error('write error');
    });
    const fn = mock.fn(async () => 'ok');

    const result = await withCache(makeFastify(redis), 'key', 600, fn);

    assert.equal(result, 'ok');
    assert.equal(fn.mock.callCount(), 1);
  });

  test('propagates fn error and does not write to Redis', async () => {
    const redis = makeRedis();
    const fn = mock.fn(async () => {
      throw new Error('upstream failure');
    });

    await assert.rejects(
      () => withCache(makeFastify(redis), 'key', 600, fn),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'upstream failure');
        return true;
      },
    );

    assert.equal(redis.set.mock.callCount(), 0);
  });
});
