import { ZodType } from 'zod';

import { FastifyRequest } from 'fastify';
import { AppError } from '../commons/interfaces/AppError.js';

const validateSchema = <T extends Record<string, unknown>>(request: FastifyRequest, schema: ZodType<T>, errorMessage: string): T => {
  const parseResult = schema.safeParse(request.body);
  
  if (!parseResult.success) {
    const error = request.server.httpErrors.badRequest(errorMessage) as AppError;
    error.details = parseResult.error;
    throw error;
  }
  
  return parseResult.data;
};

export default validateSchema;