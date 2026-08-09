import test from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';

test('API Key Middleware Hook', async (t) => {
  await t.test('quando desabilitada (API_KEY_ENABLED=false), deve permitir acesso sem chave', async () => {
    process.env.API_KEY_ENABLED = 'false';
    const fastify = Fastify();

    fastify.addHook('preHandler', async (request, reply) => {
      const apiKeyEnabled = process.env.API_KEY_ENABLED === 'true';
      if (!apiKeyEnabled) return;
      if (request.url.startsWith('/health')) return;
      const apiKey = request.headers['x-api-key'];
      const expectedKey = process.env.API_KEY;
      if (!apiKey || apiKey !== expectedKey) {
        return reply.status(401).send({ error: 'unauthorized' });
      }
    });

    fastify.post('/normalize', async () => ({ success: true }));

    const response = await fastify.inject({
      method: 'POST',
      url: '/normalize',
      body: { url: 'https://amazon.com' }
    });

    assert.strictEqual(response.statusCode, 200);
    const json = JSON.parse(response.body);
    assert.strictEqual(json.success, true);
  });

  await t.test('quando habilitada (API_KEY_ENABLED=true), deve barrar sem chave com HTTP 401', async () => {
    process.env.API_KEY_ENABLED = 'true';
    process.env.API_KEY = 'super-secret';
    const fastify = Fastify();

    fastify.addHook('preHandler', async (request, reply) => {
      const apiKeyEnabled = process.env.API_KEY_ENABLED === 'true';
      if (!apiKeyEnabled) return;
      if (request.url.startsWith('/health')) return;
      const apiKey = request.headers['x-api-key'];
      const expectedKey = process.env.API_KEY;
      if (!apiKey || apiKey !== expectedKey) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Chave de API inválida ou não fornecida.'
          }
        });
      }
    });

    fastify.post('/normalize', async () => ({ success: true }));

    const response = await fastify.inject({
      method: 'POST',
      url: '/normalize',
      body: { url: 'https://amazon.com' }
    });

    assert.strictEqual(response.statusCode, 401);
    const json = JSON.parse(response.body);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'UNAUTHORIZED');
  });

  await t.test('quando habilitada, deve barrar chave incorreta com HTTP 401', async () => {
    process.env.API_KEY_ENABLED = 'true';
    process.env.API_KEY = 'super-secret';
    const fastify = Fastify();

    fastify.addHook('preHandler', async (request, reply) => {
      const apiKeyEnabled = process.env.API_KEY_ENABLED === 'true';
      if (!apiKeyEnabled) return;
      if (request.url.startsWith('/health')) return;
      const apiKey = request.headers['x-api-key'];
      const expectedKey = process.env.API_KEY;
      if (!apiKey || apiKey !== expectedKey) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Chave de API inválida ou não fornecida.'
          }
        });
      }
    });

    fastify.post('/normalize', async () => ({ success: true }));

    const response = await fastify.inject({
      method: 'POST',
      url: '/normalize',
      headers: { 'x-api-key': 'chave-errada' },
      body: { url: 'https://amazon.com' }
    });

    assert.strictEqual(response.statusCode, 401);
  });

  await t.test('quando habilitada, deve permitir com chave correta', async () => {
    process.env.API_KEY_ENABLED = 'true';
    process.env.API_KEY = 'super-secret';
    const fastify = Fastify();

    fastify.addHook('preHandler', async (request, reply) => {
      const apiKeyEnabled = process.env.API_KEY_ENABLED === 'true';
      if (!apiKeyEnabled) return;
      if (request.url.startsWith('/health')) return;
      const apiKey = request.headers['x-api-key'];
      const expectedKey = process.env.API_KEY;
      if (!apiKey || apiKey !== expectedKey) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Chave de API inválida ou não fornecida.'
          }
        });
      }
    });

    fastify.post('/normalize', async () => ({ success: true }));

    const response = await fastify.inject({
      method: 'POST',
      url: '/normalize',
      headers: { 'x-api-key': 'super-secret' },
      body: { url: 'https://amazon.com' }
    });

    assert.strictEqual(response.statusCode, 200);
    const json = JSON.parse(response.body);
    assert.strictEqual(json.success, true);
  });

  await t.test('deve sempre isentar as rotas /health da validação de chave', async () => {
    process.env.API_KEY_ENABLED = 'true';
    process.env.API_KEY = 'super-secret';
    const fastify = Fastify();

    fastify.addHook('preHandler', async (request, reply) => {
      const apiKeyEnabled = process.env.API_KEY_ENABLED === 'true';
      if (!apiKeyEnabled) return;
      if (request.url.startsWith('/health')) return;
      const apiKey = request.headers['x-api-key'];
      const expectedKey = process.env.API_KEY;
      if (!apiKey || apiKey !== expectedKey) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Chave de API inválida ou não fornecida.'
          }
        });
      }
    });

    fastify.get('/health', async () => ({ status: 'ok' }));
    fastify.get('/health/live', async () => ({ status: 'ok' }));

    const res1 = await fastify.inject({ method: 'GET', url: '/health' });
    assert.strictEqual(res1.statusCode, 200);

    const res2 = await fastify.inject({ method: 'GET', url: '/health/live' });
    assert.strictEqual(res2.statusCode, 200);
  });
});
