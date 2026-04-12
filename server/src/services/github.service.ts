import { FastifyInstance } from 'fastify';

import { AppError } from '../commons/interfaces/AppError.js';
import { LatestRelease } from '../commons/interfaces/LatestRelease.js';

class GithubService {
  private buildHeaders(fastify: FastifyInstance): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (fastify.config.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${fastify.config.GITHUB_TOKEN}`;
    }

    return headers;
  }

  async verifyRepo(
    fastify: FastifyInstance,
    owner: string,
    repo: string,
  ): Promise<void> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: this.buildHeaders(fastify) },
    );

    if (response.status === 404) {
      throw fastify.httpErrors.notFound('Repository not found on GitHub');
    }

    if (response.status === 429) {
      throw fastify.httpErrors.serviceUnavailable(
        'Service is busy due to GitHub API rate limits. Please try again later.',
      );
    }

    if (!response.ok) {
      throw fastify.httpErrors.badGateway('GitHub API error');
    }
  }

  async getLatestRelease(
    fastify: FastifyInstance,
    owner: string,
    name: string,
  ): Promise<LatestRelease | null> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${name}/releases/latest`,
      { headers: this.buildHeaders(fastify) },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const err: AppError = new Error(
        `GitHub API error fetching latest release for ${owner}/${name}: ${response.status}`,
      );
      err.statusCode = response.status;
      throw err;
    }

    const body = (await response.json()) as {
      tag_name: string;
      html_url: string;
      published_at: string;
    };

    return {
      tagName: body.tag_name,
      htmlUrl: body.html_url,
      publishedAt: body.published_at,
    };
  }
}

export default new GithubService();
