import test from 'node:test';
import assert from 'node:assert';
import { NormalizeService } from './NormalizeService.js';
import { MarketplaceRegistry } from '../registry/MarketplaceRegistry.js';
import { IUrlResolver } from '../../domain/ports/IUrlResolver.js';
import { IBrowserSessionFactory } from '../../domain/ports/IBrowserSessionFactory.js';
import { IApplicationEventBus } from '../../domain/ports/IApplicationEventBus.js';
import { IMarketplacePlugin } from '../../domain/ports/IMarketplacePlugin.js';

test('Sprint 2.0.5 — Agnostic plugin selection based on final navigated page.url()', async (t) => {
  const mockLogger = {
    info: () => {},
    error: () => {}
  };

  const eventBus: IApplicationEventBus = {
    publish: () => {},
    subscribe: () => () => {}
  };

  // Plugins Mocks
  const amazonPlugin: IMarketplacePlugin = {
    canHandle: (url) => url.hostname.includes('amazon'),
    getMarketplaceName: () => 'amazon',
    getInteractiveEntryUrl: () => 'https://www.amazon.com.br/gp/sign-in.html',
    normalize: async (page, finalUrl) => ({
      success: true,
      marketplace: 'amazon',
      id_produto: 'B0CX123456',
      nome_produto: 'Amazon Product Title',
      url_imagem: 'https://images.amazon.com/product.jpg',
      url_produto: 'https://www.amazon.com.br/dp/B0CX123456',
      link_afiliado: null,
      preco_anterior: null,
      preco_atual: null
    }),
    getAuthenticationStrategy: () => ({
      getValidationUrl: () => 'about:blank',
      detect: async () => ({ authenticated: false, confidence: 0, reason: 'mock', status: 'UNKNOWN', strategyVersion: 1, summary: 'mock', evidence: [] })
    })
  };

  const genericPlugin: IMarketplacePlugin = {
    canHandle: (url) => !url.hostname.includes('amazon') && !url.hostname.includes('mercadolivre') && !url.hostname.includes('shopee'),
    getMarketplaceName: () => 'generic',
    getInteractiveEntryUrl: () => '',
    normalize: async (page, finalUrl) => ({
      success: true,
      marketplace: 'generic',
      id_produto: '',
      nome_produto: 'Generic Title',
      url_imagem: '',
      url_produto: 'https://www.amazon.com.br/dp/B0CX123456',
      link_afiliado: null,
      preco_anterior: null,
      preco_atual: null
    }),
    getAuthenticationStrategy: () => ({
      getValidationUrl: () => 'about:blank',
      detect: async () => ({ authenticated: false, confidence: 0, reason: 'mock', status: 'UNKNOWN', strategyVersion: 1, summary: 'mock', evidence: [] })
    })
  };

  const registry = new MarketplaceRegistry();
  registry.register(amazonPlugin);
  registry.registerFallback(genericPlugin);

  await t.test('Cenário 1: URL Direta Amazon -> detectada finalUrl após navegação', async () => {
    // 1. Resolver resolve para o mesmo link
    const mockResolver: IUrlResolver = {
      canResolve: () => true,
      resolve: async (url) => ({
        originalUrl: url.toString(),
        finalUrl: url.toString(),
        statusCode: 200,
        pageTitle: '',
        detectedChallenge: false,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        outcome: 'RESOLVED',
        metadata: { resolver: 'DirectMarketplaceResolver', strategy: 'none', redirectCount: 0, durationMs: 0, usedBrowser: false, usedHttp: false, fallbackOccurred: false }
      })
    };

    // 2. Session simulation: a página retorna a URL final
    const mockSessionFactory: IBrowserSessionFactory = {
      createSession: async (mkt) => {
        assert.strictEqual(mkt, 'amazon'); // Deve começar sabendo que é amazon
        return {
          page: {
            goto: async () => 'https://www.amazon.com.br/dp/B0CX123456',
            getFinalUrl: () => 'https://www.amazon.com.br/dp/B0CX123456'
          } as any,
          dispose: async () => {}
        };
      }
    };

    const service = new NormalizeService(mockResolver, registry, mockSessionFactory, eventBus);
    const result = await service.normalize('https://www.amazon.com.br/dp/B0CX123456');

    assert.strictEqual(result.marketplace, 'amazon');
    assert.strictEqual(result.url_produto, 'https://www.amazon.com.br/dp/B0CX123456');
    assert.strictEqual(result.id_produto, 'B0CX123456');
    assert.strictEqual(result.nome_produto, 'Amazon Product Title');
  });

  await t.test('Cenário 2: URL com tag de afiliado -> detectada finalUrl original mantendo plugin amazon', async () => {
    // Configura a tag de afiliado esperada no teste
    process.env.AMAZON_AFFILIATE_TAG = 'aff-20';

    const mockResolver: IUrlResolver = {
      canResolve: () => true,
      resolve: async (url) => ({
        originalUrl: url.toString(),
        finalUrl: url.toString(),
        statusCode: 200,
        pageTitle: '',
        detectedChallenge: false,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        outcome: 'RESOLVED',
        metadata: { resolver: 'DirectMarketplaceResolver', strategy: 'none', redirectCount: 0, durationMs: 0, usedBrowser: false, usedHttp: false, fallbackOccurred: false }
      })
    };

    const mockSessionFactory: IBrowserSessionFactory = {
      createSession: async (mkt) => {
        assert.strictEqual(mkt, 'amazon');
        return {
          page: {
            goto: async () => 'https://www.amazon.com.br/dp/B0CX123456?tag=aff-20',
            getFinalUrl: () => 'https://www.amazon.com.br/dp/B0CX123456?tag=aff-20'
          } as any,
          dispose: async () => {}
        };
      }
    };

    const service = new NormalizeService(mockResolver, registry, mockSessionFactory, eventBus);
    const result = await service.normalize('https://www.amazon.com.br/dp/B0CX123456?tag=aff-20');

    assert.strictEqual(result.marketplace, 'amazon');
    assert.strictEqual(result.url_produto, 'https://www.amazon.com.br/dp/B0CX123456');
    assert.strictEqual(result.link_afiliado, null);
  });

  await t.test('Cenário 3: link.amazon encurtado -> detectado amazon após navegação', async () => {
    const mockResolver: IUrlResolver = {
      canResolve: () => true,
      resolve: async (url) => ({
        originalUrl: url.toString(),
        finalUrl: url.toString(), // Fica como link.amazon na fase de resolver
        statusCode: 200,
        pageTitle: '',
        detectedChallenge: false,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        outcome: 'RESOLVED',
        metadata: { resolver: 'GenericRedirectResolver', strategy: 'http', redirectCount: 0, durationMs: 0, usedBrowser: false, usedHttp: true, fallbackOccurred: false }
      })
    };

    const mockSessionFactory: IBrowserSessionFactory = {
      createSession: async (mkt) => {
        assert.strictEqual(mkt, 'amazon'); // link.amazon é reconhecido como amazon inicialmente
        return {
          page: {
            goto: async () => 'https://www.amazon.com.br/dp/B0CX123456',
            getFinalUrl: () => 'https://www.amazon.com.br/dp/B0CX123456'
          } as any,
          dispose: async () => {}
        };
      }
    };

    const service = new NormalizeService(mockResolver, registry, mockSessionFactory, eventBus);
    const result = await service.normalize('https://link.amazon/B0hDFkdYs');

    assert.strictEqual(result.marketplace, 'amazon');
    assert.strictEqual(result.url_produto, 'https://www.amazon.com.br/dp/B0CX123456');
  });

  await t.test('Cenário 4: compre.link encurtado redirecionando para Amazon -> identificado corretamente após navegação', async () => {
    const mockResolver: IUrlResolver = {
      canResolve: () => true,
      resolve: async (url) => ({
        originalUrl: url.toString(),
        finalUrl: url.toString(), // compre.link é mantido na fase de resolver se redireciona via JS
        statusCode: 200,
        pageTitle: '',
        detectedChallenge: false,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        outcome: 'RESOLVED',
        metadata: { resolver: 'GenericRedirectResolver', strategy: 'http', redirectCount: 0, durationMs: 0, usedBrowser: false, usedHttp: true, fallbackOccurred: false }
      })
    };

    const mockSessionFactory: IBrowserSessionFactory = {
      createSession: async (mkt) => {
        assert.ok(mkt === 'generic' || mkt === 'amazon');
        return {
          page: {
            goto: async () => 'https://www.amazon.com.br/dp/B0CX123456',
            getFinalUrl: () => 'https://www.amazon.com.br/dp/B0CX123456'
          } as any,
          dispose: async () => {}
        };
      }
    };

    const service = new NormalizeService(mockResolver, registry, mockSessionFactory, eventBus);
    const result = await service.normalize('https://compre.link/prod-123');

    // APÓS navegação, deve ter reidentificado para amazon!
    assert.strictEqual(result.marketplace, 'amazon');
    assert.strictEqual(result.url_produto, 'https://www.amazon.com.br/dp/B0CX123456');
    assert.strictEqual(result.id_produto, 'B0CX123456');
  });
});
