import { z } from 'zod';

export const unsubscribeTokenParamsSchema = z
  .object({
    token: z.uuid(),
  })
  .strict();
