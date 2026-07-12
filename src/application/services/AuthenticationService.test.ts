import test from 'node:test';
import assert from 'node:assert';
import { AuthenticationService } from './AuthenticationService.js';
import { AuthenticationRegistry } from '../../infrastructure/adapters/browser/AuthenticationRegistry.js';
import { MarketplaceRegistry } from '../registry/MarketplaceRegistry.js';
import { IBrowserRuntime } from '../../domain/ports/IBrowserRuntime.js';
import { IProfileManager } from '../../domain/ports/IProfileManager.js';
import { IApplicationEventBus, ApplicationEvent } from '../../domain/ports/IApplicationEventBus.js';

test('AuthenticationService unit tests', async (t) => {
  const mockLogger = {
    info: () => {},
    error: () => {}
  };

  const browserProfile = {
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'light' as const
  };

  // Mock do Plugin de Marketplace
  const mockPlugin = {
    canHandle: (url: URL) => url.hostname.includes('amazon'),
    getMarketplaceName: () => 'amazon',
    getInteractiveEntryUrl: () => 'https://www.amazon.com/ap/signin',
    normalize: async () => ({} as any),
    getAuthenticationStrategy: () => ({
      getValidationUrl: () => 'about:blank',
      detect: async () => ({ authenticated: false, confidence: 0, reason: 'mock', status: 'UNKNOWN' as const, strategyVersion: 1, summary: 'mock', evidence: [] })
    })
  };

  const marketplaceRegistry = new MarketplaceRegistry();
  marketplaceRegistry.register(mockPlugin);

  // Mock do ProfileManager
  const mockProfileManager: IProfileManager = {
    getProfile: async () => ({ id: 'amazon-main', status: 'ACTIVE' }),
    createProfile: async () => ({ id: 'amazon-main', status: 'CREATED' }),
    saveProfileState: async () => {},
    deleteProfile: async () => {},
    listProfiles: async () => [],
    validateProfile: async () => true,
    importProfile: async () => {},
    importStorageState: async () => ({ profileVersion: 1, importedAt: '' }),
    loadStorageState: async () => ({})
  };

  // Mock do Playwright Page & Context
  let pageGotoUrl: string | null = null;
  let pageGotoOptions: any = null;
  let contextClosed = false;

  const mockPage = {
    goto: async (url: string, options: any) => {
      pageGotoUrl = url;
      pageGotoOptions = options;
    },
    close: async () => {}
  };

  const mockContext = {
    newPage: async () => mockPage,
    close: async () => {
      contextClosed = true;
    }
  };

  const mockBrowser = {
    newContext: async () => mockContext
  };

  const mockBrowserRuntime: IBrowserRuntime = {
    start: async () => {},
    shutdown: async () => {},
    getWorkerBrowser: () => mockBrowser,
    getInteractiveBrowser: () => mockBrowser,
    healthCheck: async () => ({ workerAlive: true, interactiveAlive: true })
  };

  const mockContextFactory = {
    createInteractiveContext: async (browser: any, profile?: any) => mockContext as any,
    disposeContext: async (context: any) => {
      contextClosed = true;
    }
  } as any;

  await t.test('inicia autenticação com sucesso abrindo janela e publicando eventos', async () => {
    const registry = new AuthenticationRegistry();
    const publishedEvents: ApplicationEvent[] = [];
    const eventBus: IApplicationEventBus = {
      publish: (evt) => {
        publishedEvents.push(evt);
      },
      subscribe: () => () => {}
    };

    const service = new AuthenticationService(
      mockBrowserRuntime,
      registry,
      eventBus,
      marketplaceRegistry,
      mockProfileManager,
      browserProfile,
      mockContextFactory,
      mockLogger
    );

    const result = await service.authenticate('amazon', 'amazon-main', 'trace-id-123', 'request-id-456');

    // 1. Verificar retorno do contrato HTTP
    assert.ok(result.authenticationId);
    assert.strictEqual(result.marketplace, 'amazon');
    assert.strictEqual(result.profileId, 'amazon-main');
    assert.strictEqual(result.status, 'WAITING_LOGIN');
    assert.ok(result.startedAt);
    assert.ok(result.expiresAt);

    // 2. Verificar se a navegação ocorreu corretamente
    assert.strictEqual(pageGotoUrl, 'https://www.amazon.com/ap/signin');
    assert.strictEqual(pageGotoOptions.waitUntil, 'domcontentloaded');

    // 3. Verificar persistência no registro em memória
    const session = registry.get(result.authenticationId);
    assert.ok(session);
    assert.strictEqual(session?.marketplace, 'amazon');
    assert.strictEqual(session?.profileId, 'amazon-main');
    assert.strictEqual(session?.status, 'WAITING_LOGIN');

    // 4. Verificar publicação de eventos
    assert.strictEqual(publishedEvents.length, 2);
    assert.strictEqual(publishedEvents[0].event, 'AUTHENTICATION_STARTED');
    assert.strictEqual(publishedEvents[0].traceId, 'trace-id-123');
    assert.strictEqual(publishedEvents[0].requestId, 'request-id-456');

    assert.strictEqual(publishedEvents[1].event, 'PAGE_NAVIGATED');
    assert.strictEqual(publishedEvents[1].payload.url, 'https://www.amazon.com/ap/signin');
  });

  await t.test('fecha recursos e publica AUTHENTICATION_FAILED se goto falhar', async () => {
    const registry = new AuthenticationRegistry();
    const publishedEvents: ApplicationEvent[] = [];
    const eventBus: IApplicationEventBus = {
      publish: (evt) => {
        publishedEvents.push(evt);
      },
      subscribe: () => () => {}
    };

    // Forçar falha no goto
    const failingPage = {
      goto: async () => {
        throw new Error('Timeout de navegação simulado');
      },
      close: async () => {}
    };
    const mockFailingContext = {
      newPage: async () => failingPage,
      close: async () => {
        contextClosed = true;
      }
    };
    const mockFailingBrowser = {
      newContext: async () => mockFailingContext
    };
    const failingRuntime: IBrowserRuntime = {
      ...mockBrowserRuntime,
      getInteractiveBrowser: () => mockFailingBrowser
    };

    const mockFailingContextFactory = {
      createInteractiveContext: async () => mockFailingContext as any,
      disposeContext: async () => {
        contextClosed = true;
      }
    } as any;

    const service = new AuthenticationService(
      failingRuntime,
      registry,
      eventBus,
      marketplaceRegistry,
      mockProfileManager,
      browserProfile,
      mockFailingContextFactory,
      mockLogger
    );

    contextClosed = false;

    await assert.rejects(
      () => service.authenticate('amazon', 'amazon-main', 'trace-id-1', 'request-id-1'),
      /Falha ao abrir a página de login: Timeout de navegação/
    );

    // Context deve ter sido fechado imediatamente
    assert.strictEqual(contextClosed, true);

    // Nenhuma sessão registrada no registry
    assert.strictEqual(registry.size(), 0);

    // Evento de falha deve ter sido publicado
    assert.strictEqual(publishedEvents.length, 1);
    assert.strictEqual(publishedEvents[0].event, 'AUTHENTICATION_FAILED');
    assert.strictEqual(publishedEvents[0].payload.reason.includes('Timeout de navegação simulado'), true);
  });

  await t.test('finishAuthentication - lança erro se authenticationId não existir no Registry', async () => {
    const registry = new AuthenticationRegistry();
    const eventBus: IApplicationEventBus = { publish: () => {}, subscribe: () => () => {} };
    const service = new AuthenticationService(
      mockBrowserRuntime,
      registry,
      eventBus,
      marketplaceRegistry,
      mockProfileManager,
      browserProfile,
      mockContextFactory,
      mockLogger
    );

    await assert.rejects(
      () => service.finishAuthentication('amazon', 'amazon-main', 'auth-fake'),
      (err: any) => {
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.message, 'Authentication not found.');
        return true;
      }
    );
  });

  await t.test('finishAuthentication - lança erro se marketplace ou profileId forem incompatíveis', async () => {
    const registry = new AuthenticationRegistry();
    const eventBus: IApplicationEventBus = { publish: () => {}, subscribe: () => () => {} };
    const service = new AuthenticationService(
      mockBrowserRuntime,
      registry,
      eventBus,
      marketplaceRegistry,
      mockProfileManager,
      browserProfile,
      mockContextFactory,
      mockLogger
    );

    const mockSession = {
      authenticationId: 'auth-123',
      marketplace: 'amazon',
      profileId: 'amazon-main',
      context: mockContext as any,
      page: mockPage as any,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      status: 'WAITING_LOGIN' as const
    };
    registry.register('auth-123', mockSession);

    // Marketplace incompatível
    await assert.rejects(
      () => service.finishAuthentication('shopee', 'amazon-main', 'auth-123'),
      (err: any) => {
        assert.strictEqual(err.statusCode, 404);
        return true;
      }
    );

    // Profile incompatível
    await assert.rejects(
      () => service.finishAuthentication('amazon', 'amazon-other', 'auth-123'),
      (err: any) => {
        assert.strictEqual(err.statusCode, 404);
        return true;
      }
    );
  });

  await t.test('finishAuthentication - caso feliz: salva estado, limpa recursos e publica eventos', async () => {
    const registry = new AuthenticationRegistry();
    const publishedEvents: ApplicationEvent[] = [];
    const eventBus: IApplicationEventBus = {
      publish: (evt) => {
        publishedEvents.push(evt);
      },
      subscribe: () => () => {}
    };

    let saveProfileStateCalled = false;
    let saveProfileStateArgs: any = null;

    const testProfileManager: IProfileManager = {
      ...mockProfileManager,
      saveProfileState: async (mkt, pid, state, browserVersion) => {
        saveProfileStateCalled = true;
        saveProfileStateArgs = { mkt, pid, state, browserVersion };
      },
      getProfile: async () => ({
        id: 'amazon-main',
        metadata: { version: 5 }
      })
    };

    const testContextFactory = {
      createInteractiveContext: async () => testContext as any,
      disposeContext: async () => {
        contextClosedLocal = true;
      }
    } as any;

    const service = new AuthenticationService(
      mockBrowserRuntime,
      registry,
      eventBus,
      marketplaceRegistry,
      testProfileManager,
      browserProfile,
      testContextFactory,
      mockLogger
    );

    let pageClosed = false;
    const testPage = {
      close: async () => {
        pageClosed = true;
      }
    };

    let contextClosedLocal = false;
    const testContext = {
      newPage: async () => testPage,
      close: async () => {
        contextClosedLocal = true;
      },
      storageState: async () => ({ cookies: [{ name: 'test-cookie', value: '123' }], origins: [] }),
      browser: () => ({ version: () => 'Chrome/120.0.0.0' })
    };

    const mockSession = {
      authenticationId: 'auth-success-123',
      marketplace: 'amazon',
      profileId: 'amazon-main',
      context: testContext as any,
      page: testPage as any,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      status: 'WAITING_LOGIN' as const
    };

    registry.register('auth-success-123', mockSession);

    const result = await service.finishAuthentication('amazon', 'amazon-main', 'auth-success-123');

    // 1. Verificar retorno de sucesso
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.profileVersion, 5);
    assert.ok(result.savedAt);

    // 2. Verificar se chamou o saveProfileState com os argumentos corretos
    assert.strictEqual(saveProfileStateCalled, true);
    assert.strictEqual(saveProfileStateArgs.mkt, 'amazon');
    assert.strictEqual(saveProfileStateArgs.pid, 'amazon-main');
    assert.deepEqual(saveProfileStateArgs.state.cookies, [{ name: 'test-cookie', value: '123' }]);
    assert.strictEqual(saveProfileStateArgs.browserVersion, 'Chrome/120.0.0.0');

    // 3. Verificar descarte de recursos
    assert.strictEqual(pageClosed, true);
    assert.strictEqual(contextClosedLocal, true);

    // 4. Verificar se limpou do Registry
    assert.strictEqual(registry.get('auth-success-123'), undefined);

    // 5. Verificar publicação de eventos
    assert.strictEqual(publishedEvents.length, 2);
    assert.strictEqual(publishedEvents[0].event, 'PROFILE_SAVED');
    assert.strictEqual(publishedEvents[0].payload.version, 5);

    assert.strictEqual(publishedEvents[1].event, 'AUTHENTICATION_COMPLETED');
    assert.strictEqual(publishedEvents[1].payload.authenticationId, 'auth-success-123');
  });
});
