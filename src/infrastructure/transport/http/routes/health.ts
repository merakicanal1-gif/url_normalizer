import { FastifyInstance } from 'fastify';
import { IBrowserRuntime } from '../../../../domain/ports/IBrowserRuntime.js';

export async function healthRoutes(
  fastify: FastifyInstance,
  options: { browserRuntime: IBrowserRuntime }
) {
  const { browserRuntime } = options;
  fastify.log.info(`[healthRoutes] Inicializado com runtimeId=${(browserRuntime as any).runtimeId}`);

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
}
