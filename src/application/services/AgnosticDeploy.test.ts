import test from 'node:test';
import assert from 'node:assert';
import { SecureCryptoHelper } from '../../infrastructure/adapters/session/SecureCryptoHelper.js';
import { PlaywrightBrowserRuntime } from '../../infrastructure/adapters/browser/PlaywrightBrowserRuntime.js';
import { PlaywrightBrowserLaunchPolicy } from '../../infrastructure/adapters/browser/PlaywrightBrowserLaunchPolicy.js';
import { AuthenticationService } from '../services/AuthenticationService.js';
import { healthRoutes } from '../../infrastructure/transport/http/routes/health.js';
import Fastify from 'fastify';

test('Sprint 2.0.6A — Production configurations, security checks and health checks', async (t) => {
  const mockLogger = {
    info: () => {},
    warn: () => {},
    error: () => {}
  };

  await t.test('SecureCryptoHelper - Falha em produção sem chave ou com chave de fallback', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.SESSION_ENCRYPTION_KEY;
    const originalKeys = process.env.SESSION_ENCRYPTION_KEYS;

    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_ENCRYPTION_KEY;
    delete process.env.SESSION_ENCRYPTION_KEYS;

    // Caso 1: Ausente
    assert.throws(
      () => new SecureCryptoHelper(),
      /Chave de criptografia de sessão ausente ou insegura em ambiente de produção/
    );

    // Caso 2: Chave de fallback insegura
    process.env.SESSION_ENCRYPTION_KEY = 'default:dev-fallback-key-change-this-in-prod';
    assert.throws(
      () => new SecureCryptoHelper(),
      /Chave de criptografia de sessão ausente ou insegura em ambiente de produção/
    );

    // Caso 3: Chave válida
    process.env.SESSION_ENCRYPTION_KEY = 'my-custom-prod-key:super-secret-key-12345';
    assert.doesNotThrow(() => new SecureCryptoHelper());

    // Restaurar env
    process.env.NODE_ENV = originalEnv;
    if (originalKey) process.env.SESSION_ENCRYPTION_KEY = originalKey;
    else delete process.env.SESSION_ENCRYPTION_KEY;
    if (originalKeys) process.env.SESSION_ENCRYPTION_KEYS = originalKeys;
    else delete process.env.SESSION_ENCRYPTION_KEYS;
  });

  await t.test('PlaywrightBrowserRuntime - Interactive Browser desabilitado por configuração', async () => {
    const originalEnabled = process.env.INTERACTIVE_BROWSER_ENABLED;
    process.env.INTERACTIVE_BROWSER_ENABLED = 'false';

    const launchPolicy = new PlaywrightBrowserLaunchPolicy('development', true);
    const runtime = new PlaywrightBrowserRuntime(mockLogger, launchPolicy);
    await runtime.start();

    // O worker browser deve iniciar, mas o interactive deve ser null
    assert.strictEqual((runtime as any).interactiveBrowser, null);
    assert.notStrictEqual((runtime as any).workerBrowser, null);

    // healthCheck deve retornar interactiveAlive = false (já que não foi iniciado)
    const check = await runtime.healthCheck();
    assert.strictEqual(check.interactiveAlive, false);
    assert.strictEqual(check.workerAlive, true);

    // getInteractiveBrowser deve falhar com INTERACTIVE_AUTHENTICATION_UNAVAILABLE
    assert.throws(
      () => runtime.getInteractiveBrowser(),
      /INTERACTIVE_AUTHENTICATION_UNAVAILABLE/
    );

    await runtime.shutdown();
    process.env.INTERACTIVE_BROWSER_ENABLED = originalEnabled;
  });

  await t.test('AuthenticationService - Rejeita login com INTERACTIVE_AUTHENTICATION_UNAVAILABLE', async () => {
    const originalEnabled = process.env.INTERACTIVE_BROWSER_ENABLED;
    process.env.INTERACTIVE_BROWSER_ENABLED = 'false';

    const runtimeMock = {
      getInteractiveBrowser: () => {
        throw new Error('INTERACTIVE_AUTHENTICATION_UNAVAILABLE');
      }
    } as any;

    const service = new AuthenticationService(
      runtimeMock,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      mockLogger
    );

    await assert.rejects(
      () => service.authenticate('amazon', 'main-profile'),
      /INTERACTIVE_AUTHENTICATION_UNAVAILABLE/
    );

    process.env.INTERACTIVE_BROWSER_ENABLED = originalEnabled;
  });

  await t.test('Healthcheck Endpoints - /health/live e /health/ready', async () => {
    const runtimeMock = {
      healthCheck: async () => ({ workerAlive: true, interactiveAlive: false }),
      runtimeId: 'test-id'
    } as any;

    const fastify = Fastify();
    await fastify.register(healthRoutes, { browserRuntime: runtimeMock });

    // Testar /health/live (Sempre 200 ok)
    const resLive = await fastify.inject({ method: 'GET', url: '/health/live' });
    assert.strictEqual(resLive.statusCode, 200);
    const bodyLive = JSON.parse(resLive.body);
    assert.strictEqual(bodyLive.status, 'ok');

    // Testar /health/ready (200 ok se workerAlive for true)
    const resReady = await fastify.inject({ method: 'GET', url: '/health/ready' });
    assert.strictEqual(resReady.statusCode, 200);
    const bodyReady = JSON.parse(resReady.body);
    assert.strictEqual(bodyReady.status, 'ok');
    assert.strictEqual(bodyReady.details.workerAlive, true);

    // Testar /health/ready degraded (503 se workerAlive for false)
    const degradedRuntimeMock = {
      healthCheck: async () => ({ workerAlive: false, interactiveAlive: true }),
      runtimeId: 'test-id'
    } as any;
    const fastifyDegraded = Fastify();
    await fastifyDegraded.register(healthRoutes, { browserRuntime: degradedRuntimeMock });

    const resReadyDegraded = await fastifyDegraded.inject({ method: 'GET', url: '/health/ready' });
    assert.strictEqual(resReadyDegraded.statusCode, 503);
    const bodyReadyDegraded = JSON.parse(resReadyDegraded.body);
    assert.strictEqual(bodyReadyDegraded.status, 'degraded');
  });

  await t.test('PlaywrightBrowserRuntime - Shutdown é totalmente idempotente', async () => {
    const launchPolicy = new PlaywrightBrowserLaunchPolicy('development', true);
    const runtime = new PlaywrightBrowserRuntime(mockLogger, launchPolicy);
    await runtime.start();

    // Primeiro shutdown encerra normalmente
    await assert.doesNotThrow(async () => await runtime.shutdown());

    // Segundos e terceiros shutdowns não devem quebrar nem crashar
    await assert.doesNotThrow(async () => await runtime.shutdown());
    await assert.doesNotThrow(async () => await runtime.shutdown());
  });
});
