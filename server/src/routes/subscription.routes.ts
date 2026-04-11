import { FastifyInstance } from 'fastify';

import subscriptionController from '../controllers/subscription.controller.js';

const subscriptionRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/subscribe', subscriptionController.subscribe);
};

export default subscriptionRoutes;