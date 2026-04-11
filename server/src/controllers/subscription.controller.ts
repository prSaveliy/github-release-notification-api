import { FastifyRequest, FastifyReply } from 'fastify';

import subscriptionService from '../services/subscription.service.js';

import validateSchema from '../utils/validateSchema.js';

import { subscribeRequestSchema } from '../commons/schemas/subscribeRequest.js';

class SubscriptionController {
  async subscribe(request: FastifyRequest, reply: FastifyReply) {
    const { email, repo } = validateSchema(
      request,
      subscribeRequestSchema,
      'Invalid request body',
    );
    await subscriptionService.subscribe(request.server, email, repo);
    return reply.status(200).send({ message: 'Confirmation email sent' });
  }
}

export default new SubscriptionController();
