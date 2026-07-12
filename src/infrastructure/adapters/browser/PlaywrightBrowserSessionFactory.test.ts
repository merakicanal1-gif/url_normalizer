import test from 'node:test';
import assert from 'node:assert';
import { PlaywrightBrowserSessionFactory } from './PlaywrightBrowserSessionFactory.js';
import { IBrowserRuntime } from '../../../domain/ports/IBrowserRuntime.js';
import { IProfileManager } from '../../../domain/ports/IProfileManager.js';
import { BrowserProfile } from '../../../domain/models/BrowserProfile.js';
import { PlaywrightBrowserLaunchPolicy } from './PlaywrightBrowserLaunchPolicy.js';
import { BrowserContextFactory } from './BrowserContextFactory.js';

test('PlaywrightBrowserSessionFactory tests', async (t) => {
  const browserProfile: BrowserProfile = {
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0'
  };

  const mockLogger = {
    info: () => {},
    error: () => {}
  };

  // Setup mock objects
  const mockPage = {
    close: async () => {}
  };

  let authenticatedContextOptions: any = null;
  let anonymousContextOptions: any = null;

  const mockBrowser = {
    newContext: async (options: any) => {
      if (options && options.storageState) {
        authenticatedContextOptions = options;
      } else {
        anonymousContextOptions = options;
      }
      return {
        newPage: async () => mockPage,
        close: async () => {},
        addInitScript: async () => {}
      };
    }
  };

  const mockRuntime: IBrowserRuntime = {
    start: async () => {},
    shutdown: async () => {},
    healthCheck: async () => ({ workerAlive: true, interactiveAlive: true }),
    getWorkerBrowser: () => mockBrowser as any,
    getInteractiveBrowser: () => mockBrowser as any
  };

  await t.test('cria contexto autenticado quando profileId existe e possui storageState', async () => {
    authenticatedContextOptions = null;
    anonymousContextOptions = null;

    const mockProfileManager: IProfileManager = {
      loadStorageState: async (mkt: string, profileId: string) => {
        if (profileId === 'valid-profile') {
          return { cookies: [{ name: 'auth-cookie', value: 'secret' }] };
        }
        return null;
      }
    } as any;

    const launchPolicy = new PlaywrightBrowserLaunchPolicy('development', true);
    const contextFactory = new BrowserContextFactory(launchPolicy);
    const factory = new PlaywrightBrowserSessionFactory(mockRuntime, mockProfileManager, browserProfile, contextFactory, mockLogger);
    const session = await factory.createSession('amazon', 'valid-profile');

    assert.ok(session);
    assert.ok(session.page);
    assert.ok(authenticatedContextOptions);
    assert.strictEqual(authenticatedContextOptions.storageState.cookies[0].name, 'auth-cookie');
    assert.strictEqual(anonymousContextOptions, null);

    await session.dispose();
  });

  await t.test('cria contexto anônimo quando profileId não existe ou não possui storageState', async () => {
    authenticatedContextOptions = null;
    anonymousContextOptions = null;

    const mockProfileManager: IProfileManager = {
      loadStorageState: async () => null
    } as any;

    const launchPolicy = new PlaywrightBrowserLaunchPolicy('development', true);
    const contextFactory = new BrowserContextFactory(launchPolicy);
    const factory = new PlaywrightBrowserSessionFactory(mockRuntime, mockProfileManager, browserProfile, contextFactory, mockLogger);
    const session = await factory.createSession('amazon', 'non-existent-profile');

    assert.ok(session);
    assert.ok(session.page);
    assert.strictEqual(authenticatedContextOptions, null);
    assert.ok(anonymousContextOptions);

    await session.dispose();
  });
});
