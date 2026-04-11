import { FastifyRequest, FastifyReply } from 'fastify';

import subscriptionService from '../services/subscription.service.js';

import validate from '../utils/validate.js';

import { subscribeRequestSchema } from '../commons/schemas/subscribeRequest.js';
import { confirmTokenParamsSchema } from '../commons/schemas/confirmToken.js';
import { unsubscribeTokenParamsSchema } from '../commons/schemas/unsubscribeToken.js';
import { subscriptionsQuerySchema } from '../commons/schemas/subscriptionsQuery.js';

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

  async confirm(request: FastifyRequest, reply: FastifyReply) {
    const { token } = validate(
      request,
      confirmTokenParamsSchema,
      'Invalid token',
      'params',
    );
    await subscriptionService.confirm(request.server, token);
    return reply.status(200).send({ message: 'Subscription confirmed' });
  }

  async unsubscribe(request: FastifyRequest, reply: FastifyReply) {
    const { token } = validate(
      request,
      unsubscribeTokenParamsSchema,
      'Invalid token',
      'params',
    );
    await subscriptionService.unsubscribe(request.server, token);
    return reply.status(200).send({ message: 'Unsubscribed successfully' });
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const { email } = validate(
      request,
      subscriptionsQuerySchema,
      'Invalid email',
      'query',
    );
    const subs = await subscriptionService.listByEmail(request.server, email);
    return reply.status(200).send(subs);
  }
}

export default new SubscriptionController();