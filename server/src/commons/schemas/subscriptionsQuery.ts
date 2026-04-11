import { z } from 'zod';

export const subscriptionsQuerySchema = z
  .object({
    email: z.email(),
  })
  .strict();
