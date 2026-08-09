import { FastifyInstance } from 'fastify';
import { BrowserHealthService } from '../../../../application/services/BrowserHealthService.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export async function healthRoutes(
  fastify: FastifyInstance,
  options: { 
    browserHealthService: BrowserHealthService;
    host?: string;
    port?: number;
    tailscaleIp?: string;
  }
) {
  const { browserHealthService } = options;

  // Compatibilidade com contrato legado, enriquecido pelo BrowserHealthService
  fastify.get('/health', async (_request, reply) => {
    const check = await browserHealthService.getStatus();
    
    // Compatibilidade com mocks de teste que não possuem a propriedade 'details' aninhada
    const details = check.details || check;
    const isReady = check.details ? check.details.ready : (check.running && check.contextAlive);

    return reply.status(isReady ? 200 : 503).send({
      status: check.status || (isReady ? 'ok' : 'degraded'),
      details: details
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

    // Compatibilidade com mocks de teste que não possuem a propriedade 'details' aninhada
    const details = check.details || check;
    const isReady = check.details ? check.details.ready : (check.running && check.contextAlive);

    return reply.status(isReady ? 200 : 503).send({
      status: check.status || (isReady ? 'ok' : 'degraded'),
      details: details
    });
  });

  // Endpoint /status detalhado para n8n e monitoramento de produção
  fastify.get('/status', async (_request, reply) => {
    const check = await browserHealthService.getStatus();
    const config = browserHealthService.getBrowserConfig();

    const isAmazonLoaded = fs.existsSync(path.join(config.userDataDir, 'amazon'));
    const isMercadoLivreLoaded = fs.existsSync(path.join(config.userDataDir, 'mercadolivre'));

    return reply.status(200).send({
      success: true,
      status: check.details ? (check.details.ready ? 'online' : 'degraded') : (check.running ? 'online' : 'degraded'),
      version: '0.1.0',
      environment: process.env.NODE_ENV || 'production',
      runtime: check.details ? check.details.mode : (check.persistent ? 'persistent' : 'cdp'),
      browser: check.details ? check.details.browser : (check.running ? 'running' : 'stopped'),
      headless: check.details ? check.details.headless : !!check.headless,
      host: options.host || '0.0.0.0',
      port: options.port || 3007,
      tailscale_ip: options.tailscaleIp || '100.xxx.xxx.xxx',
      tailscale_url: `http://${options.tailscaleIp || '100.xxx.xxx.xxx'}:${options.port || 3007}`,
      uptime_seconds: check.uptime,
      sessions: {
        amazon: isAmazonLoaded ? 'loaded' : 'not_loaded',
        mercadolivre: isMercadoLivreLoaded ? 'loaded' : 'not_loaded'
      }
    });
  });
}
