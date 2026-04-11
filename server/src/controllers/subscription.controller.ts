import { FastifyRequest, FastifyReply } from 'fastify';

import subscriptionService from '../services/subscription.service.js';

import validate from '../utils/validate.js';

import { subscribeRequestSchema } from '../commons/schemas/subscribeRequest.js';

class SubscriptionController {
  async subscribe(request: FastifyRequest, reply: FastifyReply) {
    const { email, repo } = validate(
      request,
      subscribeRequestSchema,
      'Invalid input',
    );
    await subscriptionService.subscribe(request.server, email, repo);
    return reply.status(200).send({ message: 'Confirmation email sent' });
  }
}

export default new SubscriptionController();
