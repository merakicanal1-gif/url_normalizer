import test from 'node:test';
import assert from 'node:assert';
import { NormalizeService } from './NormalizeService.js';
import { IUrlResolver, ResolvedUrl } from '../../domain/ports/IUrlResolver.js';
import { MarketplaceRegistry } from '../registry/MarketplaceRegistry.js';
import { IBrowserSessionFactory } from '../../domain/ports/IBrowserSessionFactory.js';
import { IApplicationEventBus, ApplicationEvent } from '../../domain/ports/IApplicationEventBus.js';
import { IMarketplacePlugin } from '../../domain/ports/IMarketplacePlugin.js';
import { INavigatorPage } from '../../domain/ports/INavigator.js';

test('NormalizeService unit & integration tests', async (t) => {
  // 1. Mocks genéricos
  const mockResolvedUrl: ResolvedUrl = {
    originalUrl: 'https://amzn.to/prod-123',
    finalUrl: 'https://www.amazon.com.br/dp/B0CX123456',
    statusCode: 200,
    pageTitle: 'Test Product Title',
    detectedChallenge: false,
    detectedCaptcha: false,
    detectedConsent: false,
    detectedLogin: false,
    outcome: 'RESOLVED',
    metadata: {
      resolver: 'AmazonAffiliateResolver',
      strategy: 'http',
      redirectCount: 1,
      durationMs: 15,
      usedBrowser: false,
      usedHttp: true,
      fallbackOccurred: false
    }
  };

  const mockUrlResolver: IUrlResolver = {
    canResolve: () => true,
    resolve: async () => mockResolvedUrl
  };

  const mockProduct = {
    success: true,
    marketplace: 'amazon',
    url_final: 'https://www.amazon.com.br/dp/B0CX123456',
    id_produto: 'B0CX123456',
    titulo: 'Extracted Product Title',
    imagem: 'https://images.amazon.com/test.jpg'
  };

  const mockPlugin: IMarketplacePlugin = {
    canHandle: () => true,
    getMarketplaceName: () => 'amazon',
    getInteractiveEntryUrl: () => 'https://www.amazon.com.br/gp/sign-in.html',
    normalize: async () => mockProduct,
    getAuthenticationStrategy: () => ({
      getValidationUrl: () => 'about:blank',
      detect: async () => ({ authenticated: false, confidence: 0, reason: 'mock', status: 'UNKNOWN', strategyVersion: 1, summary: 'mock', evidence: [] })
    })
  };

  const mockRegistry = new MarketplaceRegistry();
  mockRegistry.register(mockPlugin);

  await t.test('normalize sem perfil - cria contexto anônimo, executa fluxo com sucesso e fecha a página/contexto', async () => {
    const publishedEvents: ApplicationEvent[] = [];
    const eventBus: IApplicationEventBus = {
      publish: (evt) => { publishedEvents.push(evt); },
      subscribe: () => () => {}
    };

    let sessionCreated = false;
    let disposeCalled = false;
    let createSessionArgs: any = null;

    const mockSessionFactory: IBrowserSessionFactory = {
      createSession: async (mkt, profileId) => {
        sessionCreated = true;
        createSessionArgs = { mkt, profileId };
        return {
          page: {
            goto: async () => {},
            getFinalUrl: () => 'https://www.amazon.com.br/dp/B0CX123456',
            evaluate: async () => ({})
          } as any,
          dispose: async () => {
            disposeCalled = true;
          }
        };
      }
    };

    const service = new NormalizeService(mockUrlResolver, mockRegistry, mockSessionFactory, eventBus);
    const result = await service.normalize('https://amzn.to/prod-123');

    assert.deepEqual(result, mockProduct);
    assert.strictEqual(sessionCreated, true);
    assert.strictEqual(createSessionArgs.profileId, undefined);
    assert.strictEqual(disposeCalled, true);

    // Validar publicação de eventos
    assert.strictEqual(publishedEvents.length, 4);
    assert.strictEqual(publishedEvents[0].event, 'NORMALIZATION_STARTED');
    assert.strictEqual(publishedEvents[1].event, 'NORMALIZE_COMPLETED');
    assert.strictEqual(publishedEvents[2].event, 'NORMALIZATION_COMPLETED');
    assert.strictEqual(publishedEvents[3].event, 'PRODUCT_EXTRACTED');
  });

  await t.test('normalize usando perfil autenticado e carregando storageState correto', async () => {
    const publishedEvents: ApplicationEvent[] = [];
    const eventBus: IApplicationEventBus = {
      publish: (evt) => { publishedEvents.push(evt); },
      subscribe: () => () => {}
    };

    let sessionCreatedWithProfile: string | undefined = undefined;

    const mockSessionFactory: IBrowserSessionFactory = {
      createSession: async (mkt, profileId) => {
        sessionCreatedWithProfile = profileId;
        return {
          page: {
            goto: async () => {},
            getFinalUrl: () => 'https://www.amazon.com.br/dp/B0CX123456',
            evaluate: async () => ({})
          } as any,
          dispose: async () => {}
        };
      }
    };

    const service = new NormalizeService(mockUrlResolver, mockRegistry, mockSessionFactory, eventBus);
    await service.normalize('https://amzn.to/prod-123', 'amazon-profile-xyz');

    assert.strictEqual(sessionCreatedWithProfile, 'amazon-profile-xyz');
    assert.strictEqual(publishedEvents[0].payload.profileId, 'amazon-profile-xyz');
  });

  await t.test('erro de navegação - executa dispose() em bloco finally e publica NORMALIZATION_FAILED', async () => {
    const publishedEvents: ApplicationEvent[] = [];
    const eventBus: IApplicationEventBus = {
      publish: (evt) => { publishedEvents.push(evt); },
      subscribe: () => () => {}
    };

    let disposeCalled = false;

    const mockSessionFactory: IBrowserSessionFactory = {
      createSession: async () => {
        return {
          page: {
            goto: async () => {
              throw new Error('Navegação falhou!');
            },
            getFinalUrl: () => ''
          } as any,
          dispose: async () => {
            disposeCalled = true;
          }
        };
      }
    };

    const service = new NormalizeService(mockUrlResolver, mockRegistry, mockSessionFactory, eventBus);

    await assert.rejects(
      () => service.normalize('https://amzn.to/prod-123'),
      /Navegação falhou!/
    );

    assert.strictEqual(disposeCalled, true);
    assert.strictEqual(publishedEvents.length, 2); // STARTED e FAILED
    assert.strictEqual(publishedEvents[0].event, 'NORMALIZATION_STARTED');
    assert.strictEqual(publishedEvents[1].event, 'NORMALIZATION_FAILED');
    assert.strictEqual(publishedEvents[1].payload.reason, 'Navegação falhou!');
  });
});
