import { describe, test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import githubService from '../../src/services/github.service.js';

type FetchResponse = {
  status: number;
  ok: boolean;
  headers: { get: (key: string) => string | null };
  json: () => Promise<unknown>;
};

const makeResponse = (
  status: number,
  body: unknown = null,
  headers: Record<string, string> = {},
): FetchResponse => ({
  status,
  ok: status >= 200 && status < 300,
  headers: {
    get: (key: string) => headers[key] ?? null,
  },
  json: async () => body,
});

const makeFastify = (overrides: Partial<{ GITHUB_TOKEN: string }> = {}) => ({
  config: {
    GITHUB_TOKEN: overrides.GITHUB_TOKEN,
  },
});

describe('githubService.getLatestRelease()', () => {
  afterEach(() => mock.restoreAll());

  test('parses 200 response into LatestRelease shape', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () =>
      makeResponse(
        200,
        {
          tag_name: 'v1.2.3',
          html_url: 'https://github.com/owner/name/releases/tag/v1.2.3',
          published_at: '2026-04-10T12:00:00Z',
        },
        {},
      ) as unknown as Response,
    );

    const result = await githubService.getLatestRelease(
      makeFastify() as any,
      'owner',
      'name',
    );

    assert.deepEqual(result, {
      tagName: 'v1.2.3',
      htmlUrl: 'https://github.com/owner/name/releases/tag/v1.2.3',
      publishedAt: '2026-04-10T12:00:00Z',
    });

    assert.equal(fetchMock.mock.callCount(), 1);
    const url = fetchMock.mock.calls[0].arguments[0];
    assert.equal(
      url,
      'https://api.github.com/repos/owner/name/releases/latest',
    );
  });

  test('returns null on 404', async () => {
    mock.method(globalThis, 'fetch', async () =>
      makeResponse(404) as unknown as Response,
    );

    const result = await githubService.getLatestRelease(
      makeFastify() as any,
      'owner',
      'missing',
    );

    assert.equal(result, null);
  });

  test('throws with statusCode=429 on 429', async () => {
    mock.method(globalThis, 'fetch', async () =>
      makeResponse(429) as unknown as Response,
    );

    await assert.rejects(
      () =>
        githubService.getLatestRelease(makeFastify() as any, 'owner', 'name'),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal((err as { statusCode?: number }).statusCode, 429);
        return true;
      },
    );
  });

  test('attaches Authorization header when GITHUB_TOKEN is set', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () =>
      makeResponse(
        200,
        {
          tag_name: 'v1',
          html_url: 'https://example.com',
          published_at: '2026-01-01T00:00:00Z',
        },
        {},
      ) as unknown as Response,
    );

    await githubService.getLatestRelease(
      makeFastify({ GITHUB_TOKEN: 'secret' }) as any,
      'owner',
      'name',
    );

    const init = fetchMock.mock.calls[0].arguments[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    assert.equal(headers['Authorization'], 'Bearer secret');
    assert.equal(headers['Accept'], 'application/vnd.github+json');
  });

  test('omits Authorization header when GITHUB_TOKEN is absent', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () =>
      makeResponse(
        200,
        {
          tag_name: 'v1',
          html_url: 'https://example.com',
          published_at: '2026-01-01T00:00:00Z',
        },
        {},
      ) as unknown as Response,
    );

    await githubService.getLatestRelease(makeFastify() as any, 'owner', 'name');

    const init = fetchMock.mock.calls[0].arguments[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    assert.equal(headers['Authorization'], undefined);
  });

  test('throws on unexpected 5xx', async () => {
    mock.method(globalThis, 'fetch', async () =>
      makeResponse(500) as unknown as Response,
    );

    await assert.rejects(
      () =>
        githubService.getLatestRelease(makeFastify() as any, 'owner', 'name'),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        return true;
      },
    );
  });
});
