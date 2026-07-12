import test from 'node:test';
import assert from 'node:assert';
import { PlaywrightBrowserRuntime } from './PlaywrightBrowserRuntime.js';
import { PlaywrightBrowserLaunchPolicy } from './PlaywrightBrowserLaunchPolicy.js';

test('PlaywrightBrowserRuntime lifecycle and singletons', async (t) => {
  const mockLogger = {
    info: () => {},
    warn: () => {},
    error: () => {}
  };

  const launchPolicy = new PlaywrightBrowserLaunchPolicy('development', true);

  await t.test('start, verify active instances, and close', async () => {
    const runtime = new PlaywrightBrowserRuntime(mockLogger, launchPolicy);

    // Deve lançar erro se tentar obter antes de iniciar
    assert.throws(() => runtime.getInteractiveBrowser(), /Interactive Browser não foi/);
    assert.throws(() => runtime.getWorkerBrowser(), /Worker Browser não foi/);

    // Inicialização real dos navegadores locais
    await runtime.start();

    const interactive = runtime.getInteractiveBrowser();
    const worker = runtime.getWorkerBrowser();

    assert.ok(interactive);
    assert.ok(worker);
    assert.strictEqual(interactive.isConnected(), true);
    assert.strictEqual(worker.isConnected(), true);

    const health = await runtime.healthCheck();
    assert.strictEqual(health.workerAlive, true);
    assert.strictEqual(health.interactiveAlive, true);

    // Shutdown limpo
    await runtime.shutdown();

    assert.throws(() => runtime.getInteractiveBrowser(), /Interactive Browser não foi/);
    assert.throws(() => runtime.getWorkerBrowser(), /Worker Browser não foi/);

    const healthAfter = await runtime.healthCheck();
    assert.strictEqual(healthAfter.workerAlive, false);
    assert.strictEqual(healthAfter.interactiveAlive, false);
  });
});
