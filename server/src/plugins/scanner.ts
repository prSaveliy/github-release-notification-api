import fp from 'fastify-plugin';
import fastifySchedule from '@fastify/schedule';
import { AsyncTask, SimpleIntervalJob } from 'toad-scheduler';

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import scannerService from '../services/scanner.service.js';

const scannerPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!fastify.config.SCAN_ENABLED) {
    fastify.log.info('scanner disabled via SCAN_ENABLED=false');
    return;
  }

  await fastify.register(fastifySchedule);

  const task = new AsyncTask(
    'scan-releases',
    () => scannerService.runScanCycle(fastify),
    (err) => fastify.log.error({ err }, 'scan cycle crashed'),
  );

  const job = new SimpleIntervalJob(
    {
      milliseconds: fastify.config.SCAN_INTERVAL_MS,
      runImmediately: false,
    },
    task,
  );

  fastify.scheduler.addSimpleIntervalJob(job);
  fastify.log.info(
    { intervalMs: fastify.config.SCAN_INTERVAL_MS },
    'scanner scheduled',
  );
};

export default fp(scannerPlugin);
