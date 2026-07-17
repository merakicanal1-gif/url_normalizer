import { FastifyInstance } from 'fastify';
import { BrowserHealthService } from '../../../../application/services/BrowserHealthService.js';

export async function healthRoutes(
  fastify: FastifyInstance,
  options: { browserHealthService: BrowserHealthService }
) {
  const { browserHealthService } = options;

  // Compatibilidade com contrato legado, enriquecido pelo BrowserHealthService
  fastify.get('/health', async (_request, reply) => {
    const check = await browserHealthService.getStatus();
    const isOk = check.running && check.contextOpen;
    return reply.status(isOk ? 200 : 503).send({
      status: isOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: check.uptime,
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

  // Healthcheck de readiness para o processamento de normalização (depende do worker/contexto aberto)
  fastify.get('/health/ready', async (_request, reply) => {
    const check = await browserHealthService.getStatus();
    const isReady = check.running && check.contextOpen;
    return reply.status(isReady ? 200 : 503).send({
      status: isReady ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: check.uptime,
      details: check
    });
  });
}
