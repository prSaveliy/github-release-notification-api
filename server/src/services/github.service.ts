import { FastifyInstance } from 'fastify';

class GithubService {
  async verifyRepo(fastify: FastifyInstance, owner: string, repo: string): Promise<void> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (fastify.config.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${fastify.config.GITHUB_TOKEN}`;
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });

    if (response.status === 404) {
      throw fastify.httpErrors.notFound('Repository not found on GitHub');
    }

    if (response.status === 429) {
      throw fastify.httpErrors.tooManyRequests('GitHub API rate limit exceeded');
    }

    if (!response.ok) {
      throw fastify.httpErrors.badGateway('GitHub API error');
    }
  }
}

export default new GithubService();
