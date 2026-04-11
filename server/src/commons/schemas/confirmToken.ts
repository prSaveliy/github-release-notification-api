import { z } from 'zod';

export const confirmTokenParamsSchema = z
  .object({
    token: z.uuid(),
  })
  .strict();
