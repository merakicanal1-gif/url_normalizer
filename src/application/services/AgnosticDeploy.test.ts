import test from 'node:test';
import assert from 'node:assert';
import { healthRoutes } from '../../infrastructure/transport/http/routes/health.js';
import Fastify from 'fastify';

test('Sprint 2.0.6A — Production configurations, security checks and health checks', async (t) => {
  await t.test('Healthcheck Endpoints - /health/live e /health/ready', async () => {
    const healthServiceMock = {
      getStatus: async () => ({
        running: true,
        persistent: true,
        browserVersion: '120.0.0.0',
        managedPages: 0,
        manualPages: 0,
        browserData: './data/browser',
        headless: false,
        lastRestart: null,
        uptime: 10,
        contextAlive: true
      })
    } as any;

    const fastify = Fastify();
    await fastify.register(healthRoutes, { browserHealthService: healthServiceMock });

    // Testar /health/live (Sempre 200 ok)
    const resLive = await fastify.inject({ method: 'GET', url: '/health/live' });
    assert.strictEqual(resLive.statusCode, 200);
    const bodyLive = JSON.parse(resLive.body);
    assert.strictEqual(bodyLive.status, 'ok');

    // Testar /health/ready (200 ok se running e contextAlive forem true)
    const resReady = await fastify.inject({ method: 'GET', url: '/health/ready' });
    assert.strictEqual(resReady.statusCode, 200);
    const bodyReady = JSON.parse(resReady.body);
    assert.strictEqual(bodyReady.status, 'ok');
    assert.strictEqual(bodyReady.details.running, true);

    // Testar /health/ready degraded (503 se running ou contextAlive for false)
    const degradedHealthMock = {
      getStatus: async () => ({
        running: false,
        persistent: true,
        browserVersion: '120.0.0.0',
        managedPages: 0,
        manualPages: 0,
        browserData: './data/browser',
        headless: false,
        lastRestart: null,
        uptime: 10,
        contextAlive: false
      })
    } as any;
    const fastifyDegraded = Fastify();
    await fastifyDegraded.register(healthRoutes, { browserHealthService: degradedHealthMock });

    const resReadyDegraded = await fastifyDegraded.inject({ method: 'GET', url: '/health/ready' });
    assert.strictEqual(resReadyDegraded.statusCode, 503);
    const bodyReadyDegraded = JSON.parse(resReadyDegraded.body);
    assert.strictEqual(bodyReadyDegraded.status, 'degraded');
  });
});
