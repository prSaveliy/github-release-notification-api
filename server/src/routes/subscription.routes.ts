import { FastifyInstance } from 'fastify';

import subscriptionController from '../controllers/subscription.controller.js';

const subscriptionRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/subscribe', subscriptionController.subscribe);
  fastify.get('/confirm/:token', subscriptionController.confirm);
  fastify.get('/unsubscribe/:token', subscriptionController.unsubscribe);
  fastify.get('/subscriptions', subscriptionController.list);
};

export default subscriptionRoutes;