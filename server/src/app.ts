import Fastify from 'fastify';

const buildApp = async () => {
  const app = Fastify({
    logger: true,
    trustProxy: 1,
  });

  return app;
};

export default buildApp;
