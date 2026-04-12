import { FastifyInstance } from 'fastify';

export const withCache = async <T>(
  fastify: FastifyInstance,
  key: string,
  ttlSec: number,
  fn: () => Promise<T>,
): Promise<T> => {
  if (!fastify.redis) return fn();

  try {
    const hit = await fastify.redis.get(key);
    if (hit !== null) {
      return JSON.parse(hit) as T;
    }
  } catch (err) {
    fastify.log.warn({ err, key }, 'redis GET failed, passing through');
  }

  const value = await fn();

  try {
    await fastify.redis.set(key, JSON.stringify(value), 'EX', ttlSec);
  } catch (err) {
    fastify.log.warn({ err, key }, 'redis SET failed, value not cached');
  }

  return value;
};
