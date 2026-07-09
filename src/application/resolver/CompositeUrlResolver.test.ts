import test from 'node:test';
import assert from 'node:assert';
import { CompositeUrlResolver } from './CompositeUrlResolver.js';
import { AmazonAffiliateResolver } from '../../infrastructure/adapters/browser/AmazonAffiliateResolver.js';
import { MercadoLivreAffiliateResolver } from '../../infrastructure/adapters/browser/MercadoLivreAffiliateResolver.js';
import { ShopeeAffiliateResolver } from '../../infrastructure/adapters/browser/ShopeeAffiliateResolver.js';
import { GenericRedirectResolver } from '../../infrastructure/adapters/browser/GenericRedirectResolver.js';
import { MarketplaceHostRegistry } from '../../domain/services/MarketplaceHostRegistry.js';
import { IUrlResolver } from '../../domain/ports/IUrlResolver.js';

const mockLogger = {
  info: () => {},
  error: () => {}
};

test('MarketplaceHostRegistry - Identificação de domínios', () => {
  assert.strictEqual(MarketplaceHostRegistry.isAmazon('amazon.com.br'), true);
  assert.strictEqual(MarketplaceHostRegistry.isAmazon('www.amazon.com'), true);
  assert.strictEqual(MarketplaceHostRegistry.isAmazon('amzn.to'), true);
  assert.strictEqual(MarketplaceHostRegistry.isAmazon('link.amazon'), true);
  assert.strictEqual(MarketplaceHostRegistry.isAmazon('google.com'), false);

  assert.strictEqual(MarketplaceHostRegistry.isMercadoLivre('meli.la'), true);
  assert.strictEqual(MarketplaceHostRegistry.isMercadoLivre('mercadolivre.com.br'), true);

  assert.strictEqual(MarketplaceHostRegistry.isShopee('s.shopee.com.br'), true);
  assert.strictEqual(MarketplaceHostRegistry.isShopee('shopee.com.br'), true);

  assert.strictEqual(MarketplaceHostRegistry.isAmazonAffiliate('amzn.to'), true);
  assert.strictEqual(MarketplaceHostRegistry.isAmazonAffiliate('link.amazon'), true);
  assert.strictEqual(MarketplaceHostRegistry.isMercadoLivreAffiliate('meli.la'), true);
  assert.strictEqual(MarketplaceHostRegistry.isShopeeAffiliate('s.shopee.com.br'), true);
});

test('AmazonAffiliateResolver - canResolve', () => {
  const resolver = new AmazonAffiliateResolver(mockLogger);
  assert.strictEqual(resolver.canResolve(new URL('https://amzn.to/3XJ1Zpq')), true);
  assert.strictEqual(resolver.canResolve(new URL('https://link.amazon/B0hDFkdYs')), true);
  assert.strictEqual(resolver.canResolve(new URL('https://meli.la/31DTi8u')), false);
});

test('MercadoLivreAffiliateResolver - canResolve', () => {
  const resolver = new MercadoLivreAffiliateResolver(mockLogger);
  assert.strictEqual(resolver.canResolve(new URL('https://meli.la/31DTi8u')), true);
  assert.strictEqual(resolver.canResolve(new URL('https://amzn.to/3XJ1Zpq')), false);
});

test('ShopeeAffiliateResolver - canResolve', () => {
  const resolver = new ShopeeAffiliateResolver(mockLogger);
  assert.strictEqual(resolver.canResolve(new URL('https://s.shopee.com.br/2BD1NtkJLh')), true);
  assert.strictEqual(resolver.canResolve(new URL('https://shopee.com.br/produto')), false);
});

test('GenericRedirectResolver - canResolve', () => {
  const resolver = new GenericRedirectResolver(mockLogger);
  assert.strictEqual(resolver.canResolve(new URL('https://bit.ly/3XJ1Zpq')), true);
  assert.strictEqual(resolver.canResolve(new URL('https://amzn.to/3XJ1Zpq')), false);
  assert.strictEqual(resolver.canResolve(new URL('https://meli.la/31DTi8u')), false);
  assert.strictEqual(resolver.canResolve(new URL('https://s.shopee.com.br/2BD')), false);
});

// TESTES DE SUCESSO (RESOLVED) E DE FALHA (CONTINUE)
test('CompositeUrlResolver - Caso feliz: redirect válido → RESOLVED', async () => {
  const originalFetch = globalThis.fetch;
  
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = input.toString();
    if (urlStr === 'https://amzn.to/3XJ1Zpq') {
      return {
        status: 302,
        headers: new Headers({ 'location': 'https://www.amazon.com.br/dp/B0DJFRHR1G' })
      } as unknown as Response;
    }
    if (urlStr === 'https://www.amazon.com.br/dp/B0DJFRHR1G') {
      return {
        status: 200,
        text: async () => '<html><title>iPhone 16</title></html>',
        headers: new Headers()
      } as unknown as Response;
    }
    return { status: 404 } as unknown as Response;
  };

  const amazonResolver = new AmazonAffiliateResolver(mockLogger);
  const playwrightResolver: IUrlResolver = {
    canResolve: () => true,
    resolve: async () => {
      throw new Error('Playwright resolver não deveria ser acionado!');
    }
  };

  const composite = new CompositeUrlResolver([amazonResolver, playwrightResolver], mockLogger);
  const result = await composite.resolve(new URL('https://amzn.to/3XJ1Zpq'));

  assert.strictEqual(result.outcome, 'RESOLVED');
  assert.strictEqual(result.finalUrl, 'https://www.amazon.com.br/dp/B0DJFRHR1G');
  assert.strictEqual(result.metadata.strategy, 'http');
  assert.strictEqual(result.metadata.redirectCount, 1);
  assert.strictEqual(result.metadata.fallbackOccurred, false);

  globalThis.fetch = originalFetch;
});

test('CompositeUrlResolver - Caso múltiplos redirects válidos → RESOLVED', async () => {
  const originalFetch = globalThis.fetch;
  
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = input.toString();
    if (urlStr === 'https://amzn.to/3XJ1Zpq') {
      return {
        status: 301,
        headers: new Headers({ 'location': 'https://link.amazon/step2' })
      } as unknown as Response;
    }
    if (urlStr === 'https://link.amazon/step2') {
      return {
        status: 302,
        headers: new Headers({ 'location': 'https://www.amazon.com.br/dp/B0DJFRHR1G' })
      } as unknown as Response;
    }
    if (urlStr === 'https://www.amazon.com.br/dp/B0DJFRHR1G') {
      return {
        status: 200,
        text: async () => '<html><title>iPhone 16</title></html>',
        headers: new Headers()
      } as unknown as Response;
    }
    return { status: 404 } as unknown as Response;
  };

  const amazonResolver = new AmazonAffiliateResolver(mockLogger);
  const playwrightResolver: IUrlResolver = {
    canResolve: () => true,
    resolve: async () => {
      throw new Error('Playwright resolver não deveria ser acionado!');
    }
  };

  const composite = new CompositeUrlResolver([amazonResolver, playwrightResolver], mockLogger);
  const result = await composite.resolve(new URL('https://amzn.to/3XJ1Zpq'));

  assert.strictEqual(result.outcome, 'RESOLVED');
  assert.strictEqual(result.finalUrl, 'https://www.amazon.com.br/dp/B0DJFRHR1G');
  assert.strictEqual(result.metadata.redirectCount, 2);

  globalThis.fetch = originalFetch;
});

test('CompositeUrlResolver - Caso 403 → CONTINUE', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    return { status: 403, headers: new Headers() } as unknown as Response;
  };

  const amazonResolver = new AmazonAffiliateResolver(mockLogger);
  const playwrightResolver: IUrlResolver = {
    canResolve: () => true,
    resolve: async (url) => {
      return {
        originalUrl: url.toString(),
        finalUrl: 'https://www.amazon.com.br/dp/B0DJFRHR1G',
        statusCode: 200,
        pageTitle: 'iPhone 16 via Browser',
        detectedChallenge: false,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        outcome: 'RESOLVED',
        metadata: {
          resolver: 'PlaywrightUrlResolver',
          strategy: 'browser',
          redirectCount: 1,
          durationMs: 1000,
          usedBrowser: true,
          usedHttp: false,
          fallbackOccurred: false
        }
      };
    }
  };

  const composite = new CompositeUrlResolver([amazonResolver, playwrightResolver], mockLogger);
  const result = await composite.resolve(new URL('https://amzn.to/3XJ1Zpq'));

  // Caiu no fallback
  assert.strictEqual(result.outcome, 'RESOLVED');
  assert.strictEqual(result.metadata.resolver, 'PlaywrightUrlResolver');
  assert.strictEqual(result.metadata.fallbackOccurred, true);

  globalThis.fetch = originalFetch;
});

test('CompositeUrlResolver - Caso 404 → CONTINUE', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    return { status: 404, headers: new Headers() } as unknown as Response;
  };

  const amazonResolver = new AmazonAffiliateResolver(mockLogger);
  const playwrightResolver: IUrlResolver = {
    canResolve: () => true,
    resolve: async (url) => {
      return {
        originalUrl: url.toString(),
        finalUrl: 'https://www.amazon.com.br/dp/B0DJFRHR1G',
        statusCode: 200,
        pageTitle: 'iPhone 16 via Browser',
        detectedChallenge: false,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        outcome: 'RESOLVED',
        metadata: {
          resolver: 'PlaywrightUrlResolver',
          strategy: 'browser',
          redirectCount: 1,
          durationMs: 1000,
          usedBrowser: true,
          usedHttp: false,
          fallbackOccurred: false
        }
      };
    }
  };

  const composite = new CompositeUrlResolver([amazonResolver, playwrightResolver], mockLogger);
  const result = await composite.resolve(new URL('https://amzn.to/3XJ1Zpq'));

  assert.strictEqual(result.outcome, 'RESOLVED');
  assert.strictEqual(result.metadata.resolver, 'PlaywrightUrlResolver');
  assert.strictEqual(result.metadata.fallbackOccurred, true);

  globalThis.fetch = originalFetch;
});

test('CompositeUrlResolver - Caso 405 → CONTINUE', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    return { status: 405, headers: new Headers() } as unknown as Response;
  };

  const amazonResolver = new AmazonAffiliateResolver(mockLogger);
  const playwrightResolver: IUrlResolver = {
    canResolve: () => true,
    resolve: async (url) => {
      return {
        originalUrl: url.toString(),
        finalUrl: 'https://www.amazon.com.br/dp/B0DJFRHR1G',
        statusCode: 200,
        pageTitle: 'iPhone 16 via Browser',
        detectedChallenge: false,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        outcome: 'RESOLVED',
        metadata: {
          resolver: 'PlaywrightUrlResolver',
          strategy: 'browser',
          redirectCount: 1,
          durationMs: 1000,
          usedBrowser: true,
          usedHttp: false,
          fallbackOccurred: false
        }
      };
    }
  };

  const composite = new CompositeUrlResolver([amazonResolver, playwrightResolver], mockLogger);
  const result = await composite.resolve(new URL('https://amzn.to/3XJ1Zpq'));

  assert.strictEqual(result.outcome, 'RESOLVED');
  assert.strictEqual(result.metadata.resolver, 'PlaywrightUrlResolver');
  assert.strictEqual(result.metadata.fallbackOccurred, true);

  globalThis.fetch = originalFetch;
});

test('CompositeUrlResolver - Caso timeout → CONTINUE', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error('fetch timeout');
  };

  const amazonResolver = new AmazonAffiliateResolver(mockLogger);
  const playwrightResolver: IUrlResolver = {
    canResolve: () => true,
    resolve: async (url) => {
      return {
        originalUrl: url.toString(),
        finalUrl: 'https://www.amazon.com.br/dp/B0DJFRHR1G',
        statusCode: 200,
        pageTitle: 'iPhone 16 via Browser',
        detectedChallenge: false,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        outcome: 'RESOLVED',
        metadata: {
          resolver: 'PlaywrightUrlResolver',
          strategy: 'browser',
          redirectCount: 1,
          durationMs: 1000,
          usedBrowser: true,
          usedHttp: false,
          fallbackOccurred: false
        }
      };
    }
  };

  const composite = new CompositeUrlResolver([amazonResolver, playwrightResolver], mockLogger);
  const result = await composite.resolve(new URL('https://amzn.to/3XJ1Zpq'));

  assert.strictEqual(result.outcome, 'RESOLVED');
  assert.strictEqual(result.metadata.resolver, 'PlaywrightUrlResolver');
  assert.strictEqual(result.metadata.fallbackOccurred, true);

  globalThis.fetch = originalFetch;
});

test('CompositeUrlResolver - Caso redirectCount = 0 → CONTINUE', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    return { status: 200, headers: new Headers(), text: async () => '<html><title>Amazon</title></html>' } as unknown as Response;
  };

  const amazonResolver = new AmazonAffiliateResolver(mockLogger);
  const playwrightResolver: IUrlResolver = {
    canResolve: () => true,
    resolve: async (url) => {
      return {
        originalUrl: url.toString(),
        finalUrl: 'https://www.amazon.com.br/dp/B0DJFRHR1G',
        statusCode: 200,
        pageTitle: 'iPhone 16 via Browser',
        detectedChallenge: false,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        outcome: 'RESOLVED',
        metadata: {
          resolver: 'PlaywrightUrlResolver',
          strategy: 'browser',
          redirectCount: 1,
          durationMs: 1000,
          usedBrowser: true,
          usedHttp: false,
          fallbackOccurred: false
        }
      };
    }
  };

  const composite = new CompositeUrlResolver([amazonResolver, playwrightResolver], mockLogger);
  const result = await composite.resolve(new URL('https://amzn.to/3XJ1Zpq'));

  assert.strictEqual(result.outcome, 'RESOLVED');
  assert.strictEqual(result.metadata.resolver, 'PlaywrightUrlResolver');
  assert.strictEqual(result.metadata.fallbackOccurred, true);

  globalThis.fetch = originalFetch;
});

test('CompositeUrlResolver - Caso finalUrl == originalUrl → CONTINUE', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    return { status: 200, headers: new Headers(), text: async () => '<html><title>Amazon</title></html>' } as unknown as Response;
  };

  const amazonResolver = new AmazonAffiliateResolver(mockLogger);
  const playwrightResolver: IUrlResolver = {
    canResolve: () => true,
    resolve: async (url) => {
      return {
        originalUrl: url.toString(),
        finalUrl: 'https://www.amazon.com.br/dp/B0DJFRHR1G',
        statusCode: 200,
        pageTitle: 'iPhone 16 via Browser',
        detectedChallenge: false,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        outcome: 'RESOLVED',
        metadata: {
          resolver: 'PlaywrightUrlResolver',
          strategy: 'browser',
          redirectCount: 1,
          durationMs: 1000,
          usedBrowser: true,
          usedHttp: false,
          fallbackOccurred: false
        }
      };
    }
  };

  const composite = new CompositeUrlResolver([amazonResolver, playwrightResolver], mockLogger);
  const result = await composite.resolve(new URL('https://amzn.to/3XJ1Zpq'));

  assert.strictEqual(result.outcome, 'RESOLVED');
  assert.strictEqual(result.metadata.resolver, 'PlaywrightUrlResolver');
  assert.strictEqual(result.metadata.fallbackOccurred, true);

  globalThis.fetch = originalFetch;
});

test('CompositeUrlResolver - Caso redirect loop → CONTINUE', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const urlStr = input.toString();
    if (urlStr === 'https://amzn.to/3XJ1Zpq') {
      return {
        status: 302,
        headers: new Headers({ 'location': 'https://link.amazon/stepB' })
      } as unknown as Response;
    }
    if (urlStr === 'https://link.amazon/stepB') {
      return {
        status: 302,
        headers: new Headers({ 'location': 'https://amzn.to/3XJ1Zpq' })
      } as unknown as Response;
    }
    return { status: 404 } as unknown as Response;
  };

  const amazonResolver = new AmazonAffiliateResolver(mockLogger);
  const playwrightResolver: IUrlResolver = {
    canResolve: () => true,
    resolve: async (url) => {
      return {
        originalUrl: url.toString(),
        finalUrl: 'https://www.amazon.com.br/dp/B0DJFRHR1G',
        statusCode: 200,
        pageTitle: 'iPhone 16 via Browser',
        detectedChallenge: false,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        outcome: 'RESOLVED',
        metadata: {
          resolver: 'PlaywrightUrlResolver',
          strategy: 'browser',
          redirectCount: 2,
          durationMs: 1000,
          usedBrowser: true,
          usedHttp: false,
          fallbackOccurred: false
        }
      };
    }
  };

  const composite = new CompositeUrlResolver([amazonResolver, playwrightResolver], mockLogger);
  const result = await composite.resolve(new URL('https://amzn.to/3XJ1Zpq'));

  assert.strictEqual(result.outcome, 'RESOLVED');
  assert.strictEqual(result.metadata.resolver, 'PlaywrightUrlResolver');
  assert.strictEqual(result.metadata.fallbackOccurred, true);

  globalThis.fetch = originalFetch;
});
