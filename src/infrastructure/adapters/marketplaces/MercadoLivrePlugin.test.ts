import test from 'node:test';
import assert from 'node:assert';
import { MercadoLivrePlugin, NavigationState } from './MercadoLivrePlugin.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';
import { PageInspection } from '../../../domain/models/PageInspection.js';
import { ChallengeDetectedError } from '../../../domain/errors/ChallengeDetectedError.js';
import { MarketplaceUnavailableError } from '../../../domain/errors/MarketplaceUnavailableError.js';

const mockLogger = {
  info: () => {},
  error: () => {}
};

const createMockRawPage = () => {
  return {
    url: () => 'https://produto.mercadolivre.com.br/MLB-12345-fone',
    title: async () => 'Mock Title',
    content: async () => '<html></html>',
    screenshot: async () => Buffer.from(''),
    waitForLoadState: async () => {},
    waitForTimeout: async () => {}
  };
};

const createMockNavigatorPage = () => {
  const raw = createMockRawPage();
  return {
    getRawPage: () => raw,
    evaluate: async () => null,
    close: async () => {}
  } as unknown as INavigatorPage;
};

test('MercadoLivrePlugin - Navegação direta para produto', async () => {
  const mockClassifier = {
    classify: async (): Promise<PageInspection> => ({
      pageType: 'PRODUCT_PAGE',
      confidence: 100,
      url: 'https://produto.mercadolivre.com.br/MLB-12345-fone',
      hasCTA: false,
      hasProductImage: true,
      hasBuyBox: true,
      hasMLB: true,
      evidences: []
    })
  };

  const mockObserver = {
    waitForTransition: async () => 'traditional_navigation'
  };

  const mockValidator = {
    validate: async () => ({ isValid: true, confidence: 100, evidences: [] })
  };

  const mockExtractor = {
    extract: async () => ({
      success: true,
      marketplace: 'mercadolivre',
      url_final: 'https://produto.mercadolivre.com.br/MLB-12345-fone',
      id_produto: 'MLB12345',
      titulo: 'Fone Bluetooth',
      imagem: 'https://m.media.com/fone.jpg'
    })
  };

  const plugin = new MercadoLivrePlugin(mockLogger, mockClassifier, mockObserver, mockValidator, mockExtractor);
  const result = await plugin.normalize(createMockNavigatorPage(), new URL('https://produto.mercadolivre.com.br/MLB-12345-fone'));

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.id_produto, 'MLB12345');
  assert.strictEqual(result.titulo, 'Fone Bluetooth');
});

test('MercadoLivrePlugin - Landing para produto com clique no botão', async () => {
  let isLanding = true;
  const mockClassifier = {
    classify: async (): Promise<PageInspection> => {
      if (isLanding) {
        return {
          pageType: 'AFFILIATE_LANDING',
          confidence: 0,
          url: 'https://meli.la/xaviertech',
          hasCTA: true,
          hasProductImage: false,
          hasBuyBox: false,
          hasMLB: false,
          evidences: []
        };
      } else {
        return {
          pageType: 'PRODUCT_PAGE',
          confidence: 100,
          url: 'https://produto.mercadolivre.com.br/MLB-12345-fone',
          hasCTA: false,
          hasProductImage: true,
          hasBuyBox: true,
          hasMLB: true,
          evidences: []
        };
      }
    }
  };

  const mockObserver = {
    waitForTransition: async () => {
      isLanding = false;
      return 'url_changed_product';
    }
  };

  const mockValidator = {
    validate: async () => ({ isValid: true, confidence: 100, evidences: [] })
  };

  const mockExtractor = {
    extract: async () => ({
      success: true,
      marketplace: 'mercadolivre',
      url_final: 'https://produto.mercadolivre.com.br/MLB-12345-fone',
      id_produto: 'MLB12345',
      titulo: 'Fone Bluetooth',
      imagem: 'https://m.media.com/fone.jpg'
    })
  };

  const rawPageMock = {
    url: () => isLanding ? 'https://meli.la/xaviertech' : 'https://produto.mercadolivre.com.br/MLB-12345-fone',
    title: async () => 'Page Title',
    content: async () => '<html></html>',
    screenshot: async () => Buffer.from(''),
    waitForLoadState: async () => {},
    waitForTimeout: async () => {},
    locator: () => ({
      filter: () => ({
        first: () => ({
          waitFor: async () => {},
          click: async () => {}
        })
      })
    })
  };

  const mockNavigatorPage = {
    getRawPage: () => rawPageMock,
    evaluate: async () => null,
    close: async () => {}
  } as unknown as INavigatorPage;

  const plugin = new MercadoLivrePlugin(mockLogger, mockClassifier, mockObserver, mockValidator, mockExtractor);
  const result = await plugin.normalize(mockNavigatorPage, new URL('https://meli.la/xaviertech'));

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.id_produto, 'MLB12345');
});

test('MercadoLivrePlugin - CAPTCHA lança ChallengeDetectedError', async () => {
  const mockClassifier = {
    classify: async (): Promise<PageInspection> => ({
      pageType: 'CAPTCHA_PAGE',
      confidence: 0,
      url: 'https://www.mercadolivre.com.br/validatecaptcha',
      hasCTA: false,
      hasProductImage: false,
      hasBuyBox: false,
      hasMLB: false,
      evidences: ['Captcha text matched']
    })
  };

  const mockObserver = { waitForTransition: async () => '' };
  const mockValidator = { validate: async () => ({ isValid: false, confidence: 0, evidences: [] }) };
  const mockExtractor = { extract: async () => (null as any) };

  const plugin = new MercadoLivrePlugin(mockLogger, mockClassifier, mockObserver, mockValidator, mockExtractor);

  await assert.rejects(
    async () => {
      await plugin.normalize(createMockNavigatorPage(), new URL('https://www.mercadolivre.com.br/validatecaptcha'));
    },
    (err: any) => {
      assert.strictEqual(err.name, 'ChallengeDetectedError');
      assert.strictEqual(err.type, 'CAPTCHA');
      return true;
    }
  );
});

test('MercadoLivrePlugin - WAF lança ChallengeDetectedError', async () => {
  const mockClassifier = {
    classify: async (): Promise<PageInspection> => ({
      pageType: 'WAF_PAGE',
      confidence: 0,
      url: 'https://www.mercadolivre.com.br/bloqueio',
      hasCTA: false,
      hasProductImage: false,
      hasBuyBox: false,
      hasMLB: false,
      evidences: ['WAF matches']
    })
  };

  const mockObserver = { waitForTransition: async () => '' };
  const mockValidator = { validate: async () => ({ isValid: false, confidence: 0, evidences: [] }) };
  const mockExtractor = { extract: async () => (null as any) };

  const plugin = new MercadoLivrePlugin(mockLogger, mockClassifier, mockObserver, mockValidator, mockExtractor);

  await assert.rejects(
    async () => {
      await plugin.normalize(createMockNavigatorPage(), new URL('https://www.mercadolivre.com.br/bloqueio'));
    },
    (err: any) => {
      assert.strictEqual(err.name, 'ChallengeDetectedError');
      assert.strictEqual(err.type, 'WAF');
      return true;
    }
  );
});

test('MercadoLivrePlugin - LOGIN lança ChallengeDetectedError', async () => {
  const mockClassifier = {
    classify: async (): Promise<PageInspection> => ({
      pageType: 'LOGIN_PAGE',
      confidence: 0,
      url: 'https://www.mercadolivre.com.br/login',
      hasCTA: false,
      hasProductImage: false,
      hasBuyBox: false,
      hasMLB: false,
      evidences: []
    })
  };

  const mockObserver = { waitForTransition: async () => '' };
  const mockValidator = { validate: async () => ({ isValid: false, confidence: 0, evidences: [] }) };
  const mockExtractor = { extract: async () => (null as any) };

  const plugin = new MercadoLivrePlugin(mockLogger, mockClassifier, mockObserver, mockValidator, mockExtractor);

  await assert.rejects(
    async () => {
      await plugin.normalize(createMockNavigatorPage(), new URL('https://www.mercadolivre.com.br/login'));
    },
    (err: any) => {
      assert.strictEqual(err.name, 'ChallengeDetectedError');
      assert.strictEqual(err.type, 'LOGIN');
      return true;
    }
  );
});

test('MercadoLivrePlugin - ERROR_PAGE lança MarketplaceUnavailableError', async () => {
  const mockClassifier = {
    classify: async (): Promise<PageInspection> => ({
      pageType: 'ERROR_PAGE',
      confidence: 0,
      url: 'https://www.mercadolivre.com.br/nao-existe',
      hasCTA: false,
      hasProductImage: false,
      hasBuyBox: false,
      hasMLB: false,
      evidences: ['Page Not Found']
    })
  };

  const mockObserver = { waitForTransition: async () => '' };
  const mockValidator = { validate: async () => ({ isValid: false, confidence: 0, evidences: [] }) };
  const mockExtractor = { extract: async () => (null as any) };

  const plugin = new MercadoLivrePlugin(mockLogger, mockClassifier, mockObserver, mockValidator, mockExtractor);

  await assert.rejects(
    async () => {
      await plugin.normalize(createMockNavigatorPage(), new URL('https://www.mercadolivre.com.br/nao-existe'));
    },
    (err: any) => {
      assert.strictEqual(err.name, 'MarketplaceUnavailableError');
      assert.strictEqual(err.pageType, 'ERROR_PAGE');
      return true;
    }
  );
});
