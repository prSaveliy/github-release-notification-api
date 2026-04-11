import { z } from 'zod';

export const subscribeRequestSchema = z
  .object({
    email: z.email(),
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  })
  .strict();
