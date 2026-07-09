import test from 'node:test';
import assert from 'node:assert';
import { CompositeUrlResolver } from './CompositeUrlResolver.js';
import { DirectMarketplaceResolver } from '../../infrastructure/adapters/browser/DirectMarketplaceResolver.js';
import { AmazonAffiliateResolver } from '../../infrastructure/adapters/browser/AmazonAffiliateResolver.js';
import { GenericRedirectResolver } from '../../infrastructure/adapters/browser/GenericRedirectResolver.js';
import { PlaywrightRedirectResolver } from '../../infrastructure/adapters/browser/PlaywrightRedirectResolver.js';
import { NormalizeService } from '../services/NormalizeService.js';
import { MarketplaceRegistry } from '../registry/MarketplaceRegistry.js';
import { IBrowserSessionFactory } from '../../domain/ports/IBrowserSessionFactory.js';
import { IApplicationEventBus } from '../../domain/ports/IApplicationEventBus.js';
import { IMarketplacePlugin } from '../../domain/ports/IMarketplacePlugin.js';
import { IUrlResolver } from '../../domain/ports/IUrlResolver.js';

test('Sprint 2.0.4 — Agnostic resolver and NormalizeService integrations', async (t) => {
  const mockLogger = {
    info: () => {},
    error: () => {}
  };

  const eventBus: IApplicationEventBus = {
    publish: () => {},
    subscribe: () => () => {}
  };

  const mockProduct = {
    success: true,
    marketplace: 'amazon',
    url_final: 'https://www.amazon.com.br/dp/B0CX123456',
    id_produto: 'B0CX123456',
    titulo: 'Real Product Title',
    imagem: 'https://images.amazon.com/test.jpg'
  };

  const mockAmazonPlugin: IMarketplacePlugin = {
    canHandle: (url) => url.hostname.includes('amazon'),
    getMarketplaceName: () => 'amazon',
    getInteractiveEntryUrl: () => 'https://www.amazon.com.br/gp/sign-in.html',
    normalize: async () => mockProduct
  };

  const mockRegistry = new MarketplaceRegistry();
  mockRegistry.register(mockAmazonPlugin);

  let currentMockUrl = '';
  // Factory mock
  const mockSessionFactory: IBrowserSessionFactory = {
    createSession: async () => ({
      page: {
        goto: async (url: string) => {
          currentMockUrl = url;
          return url;
        },
        getFinalUrl: () => currentMockUrl,
        evaluate: async () => ({})
      } as any,
      dispose: async () => {}
    }),
    createInteractiveSession: async () => (null as any)
  };

  await t.test('URL direta da Amazon - resolvida imediatamente pelo DirectMarketplaceResolver', async () => {
    const directResolver = new DirectMarketplaceResolver();
    const composite = new CompositeUrlResolver([directResolver], mockLogger);

    const targetUrl = new URL('https://www.amazon.com.br/dp/B0CX123456');
    assert.strictEqual(directResolver.canResolve(targetUrl), true);

    const result = await composite.resolve(targetUrl);
    assert.strictEqual(result.outcome, 'RESOLVED');
    assert.strictEqual(result.finalUrl, targetUrl.toString());
    assert.strictEqual(result.metadata.resolver, 'DirectMarketplaceResolver');
    assert.strictEqual(result.metadata.strategy, 'none');
  });

  await t.test('URL de afiliado com parâmetro tag - resolvida com sucesso', async () => {
    const directResolver = new DirectMarketplaceResolver();
    const composite = new CompositeUrlResolver([directResolver], mockLogger);

    const targetUrl = new URL('https://www.amazon.com.br/dp/B0CX123456?tag=affiliate-20');
    assert.strictEqual(directResolver.canResolve(targetUrl), true);

    const result = await composite.resolve(targetUrl);
    assert.strictEqual(result.outcome, 'RESOLVED');
    assert.strictEqual(result.finalUrl, targetUrl.toString());
  });

  await t.test('URL encurtada amzn.to que redireciona para Amazon - resolvida via HTTP', async () => {
    const originalFetch = globalThis.fetch;
    
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const urlStr = input.toString();
      if (urlStr === 'https://amzn.to/3XJ1Zpq') {
        return {
          status: 302,
          headers: new Headers({ 'location': 'https://www.amazon.com.br/dp/B0CX123456' })
        } as unknown as Response;
      }
      if (urlStr === 'https://www.amazon.com.br/dp/B0CX123456') {
        return {
          status: 200,
          text: async () => '<html><title>Amazon Product</title></html>',
          headers: new Headers()
        } as unknown as Response;
      }
      return { status: 404 } as unknown as Response;
    };

    const amazonResolver = new AmazonAffiliateResolver(mockLogger);
    const composite = new CompositeUrlResolver([amazonResolver], mockLogger);

    const result = await composite.resolve(new URL('https://amzn.to/3XJ1Zpq'));
    assert.strictEqual(result.outcome, 'RESOLVED');
    assert.strictEqual(result.finalUrl, 'https://www.amazon.com.br/dp/B0CX123456');

    globalThis.fetch = originalFetch;
  });

  await t.test('URL de domínio desconhecido compre.link que redireciona para Amazon', async () => {
    const originalFetch = globalThis.fetch;
    
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const urlStr = input.toString();
      if (urlStr === 'https://compre.link/prod-123') {
        return {
          status: 302,
          headers: new Headers({ 'location': 'https://www.amazon.com.br/dp/B0CX123456' })
        } as unknown as Response;
      }
      if (urlStr === 'https://www.amazon.com.br/dp/B0CX123456') {
        return {
          status: 200,
          text: async () => '<html><title>Amazon Product</title></html>',
          headers: new Headers()
        } as unknown as Response;
      }
      return { status: 404 } as unknown as Response;
    };

    const genericResolver = new GenericRedirectResolver(mockLogger);
    const composite = new CompositeUrlResolver([genericResolver], mockLogger);

    const targetUrl = new URL('https://compre.link/prod-123');
    assert.strictEqual(genericResolver.canResolve(targetUrl), true);

    const result = await composite.resolve(targetUrl);
    assert.strictEqual(result.outcome, 'RESOLVED');
    assert.strictEqual(result.finalUrl, 'https://www.amazon.com.br/dp/B0CX123456');

    globalThis.fetch = originalFetch;
  });

  await t.test('PlaywrightRedirectResolver fallback final - resolve redirects de rede e JS', async () => {
    let playwrightSessionCreated = false;
    let pageGotoCalledWith: string | null = null;

    const playwrightSessionFactoryMock: IBrowserSessionFactory = {
      createSession: async (mkt, profileId) => {
        playwrightSessionCreated = true;
        return {
          page: {
            goto: async (url: string) => {
              pageGotoCalledWith = url;
              return 'https://www.amazon.com.br/dp/B0CX123456';
            }
          } as any,
          dispose: async () => {}
        };
      },
      createInteractiveSession: async () => (null as any)
    };

    const playwrightResolver = new PlaywrightRedirectResolver(playwrightSessionFactoryMock, mockLogger);
    const result = await playwrightResolver.resolve(new URL('https://compre.link/js-redirect'));

    assert.strictEqual(result.outcome, 'RESOLVED');
    assert.strictEqual(result.finalUrl, 'https://www.amazon.com.br/dp/B0CX123456');
    assert.strictEqual(playwrightSessionCreated, true);
    assert.strictEqual(pageGotoCalledWith, 'https://compre.link/js-redirect');
    assert.strictEqual(result.metadata.strategy, 'browser');
  });

  await t.test('NormalizeService - URL de domínio final com marketplace não suportado lança erro', async () => {
    // Resolver resolve para magazineluiza.com.br
    const mockResolver: IUrlResolver = {
      canResolve: () => true,
      resolve: async () => ({
        originalUrl: 'https://compre.link/prod-xyz',
        finalUrl: 'https://www.magazineluiza.com.br/produto-abc',
        statusCode: 200,
        pageTitle: 'Magazine Luiza Product',
        detectedChallenge: false,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        outcome: 'RESOLVED',
        metadata: {
          resolver: 'DirectMarketplaceResolver',
          strategy: 'none',
          redirectCount: 0,
          durationMs: 0,
          usedBrowser: false,
          usedHttp: false,
          fallbackOccurred: false
        }
      })
    };

    const service = new NormalizeService(mockResolver, mockRegistry, mockSessionFactory, eventBus);

    await assert.rejects(
      () => service.normalize('https://compre.link/prod-xyz'),
      /Marketplace não suportado: www.magazineluiza.com.br/
    );
  });
});
