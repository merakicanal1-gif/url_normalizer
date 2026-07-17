import test from 'node:test';
import assert from 'node:assert';
import * as os from 'node:os';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { LocalBrowserRuntime } from './LocalBrowserRuntime.js';
import { BrowserConfig } from './BrowserConfig.js';
import { IApplicationEventBus } from '../../../domain/ports/IApplicationEventBus.js';
import { BrowserHealthService } from '../../../application/services/BrowserHealthService.js';

test('LocalBrowserRuntime and BrowserHealthService integration', async (t) => {
  const mockLogger = {
    info: () => {},
    warn: () => {},
    error: () => {}
  };

  const mockEventBus: IApplicationEventBus = {
    publish: () => {},
    subscribe: () => () => {}
  };

  // Isolar o diretório de dados em cada execução dos testes
  const tmpDir = path.join(os.tmpdir(), `url-normalizer-test-${crypto.randomUUID()}`);
  process.env.SESSION_STORAGE_DIR = tmpDir;

  const config = new BrowserConfig();
  const runtime = new LocalBrowserRuntime(config, mockEventBus, mockLogger);
  const healthService = new BrowserHealthService(runtime);

  await t.test('fluxo completo de inicializacao, abas e shutdown', async () => {
    // Inicializar
    await runtime.start();
    assert.strictEqual(runtime.getIsRunning(), true);

    const context = await runtime.getPersistentContext();
    assert.ok(context);

    // Verificar health inicial
    let status = await healthService.getStatus();
    assert.strictEqual(status.running, true);
    assert.strictEqual(status.managedPages, 0);
    assert.strictEqual(status.manualPages, 0);

    // Criar abas
    const managedPage = await runtime.newPage(true);
    const manualPage = await runtime.newPage(false);

    status = await healthService.getStatus();
    assert.strictEqual(status.managedPages, 1);
    assert.strictEqual(status.manualPages, 1);

    // Fechar abas
    await runtime.closePage(managedPage);
    await runtime.closePage(manualPage);

    status = await healthService.getStatus();
    assert.strictEqual(status.managedPages, 0);
    assert.strictEqual(status.manualPages, 0);

    // Shutdown
    await runtime.shutdown();
    assert.strictEqual(runtime.getIsRunning(), false);

    // Limpar diretório temporário após os testes
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  });

  await t.test('modo cdp - deve lancar BrowserNotRunningError se a porta nao responder', async () => {
    process.env.BROWSER_MODE = 'cdp';
    process.env.CDP_ENDPOINT = 'http://127.0.0.1:54321'; // porta inexistente
    
    const configCdp = new BrowserConfig();
    const runtimeCdp = new LocalBrowserRuntime(configCdp, mockEventBus, mockLogger);
    
    await assert.rejects(
      async () => {
        await runtimeCdp.start();
      },
      (err: any) => {
        return err.name === 'BrowserNotRunningError' && err.code === 'BROWSER_NOT_RUNNING';
      }
    );
    
    delete process.env.BROWSER_MODE;
    delete process.env.CDP_ENDPOINT;
  });
});
