import { FastifyInstance } from 'fastify';
import { IBrowserRuntime } from '../../../../domain/ports/IBrowserRuntime.js';

export async function healthRoutes(
  fastify: FastifyInstance,
  options: { browserRuntime: IBrowserRuntime }
) {
  const { browserRuntime } = options;
  fastify.log.info(`[healthRoutes] Inicializado com runtimeId=${(browserRuntime as any).runtimeId}`);

  // Compatibilidade com contrato legado
  fastify.get('/health', async (_request, reply) => {
    const check = await browserRuntime.healthCheck();
    const isOk = check.workerAlive && check.interactiveAlive;
    return reply.status(isOk ? 200 : 503).send({
      status: isOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      details: check
    });
  });

  // Healthcheck de liveness da API Fastify
  fastify.get('/health/live', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Healthcheck de readiness para o processamento de normalização (depende do worker)
  fastify.get('/health/ready', async (_request, reply) => {
    const check = await browserRuntime.healthCheck();
    const isReady = check.workerAlive;
    return reply.status(isReady ? 200 : 503).send({
      status: isReady ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      details: check
    });
  });
}
