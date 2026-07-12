import test from 'node:test';
import assert from 'node:assert';
import { MercadoLivrePageClassifier } from './MercadoLivrePageClassifier.js';
import { INavigatorPage } from '../../../../domain/ports/INavigator.js';

test('MercadoLivrePageClassifier - Detecção de WAF', async () => {
  const classifier = new MercadoLivrePageClassifier();
  const mockPage = {
    title: async () => 'Bloqueado',
    content: async () => '<html><body>awswafintegration here</body></html>',
    url: () => 'https://www.mercadolivre.com.br/bloqueio',
    evaluate: async () => null
  };
  const mockNavigatorPage = {
    getRawPage: () => mockPage
  } as unknown as INavigatorPage;

  const inspection = await classifier.classify(mockNavigatorPage, 'https://www.mercadolivre.com.br/bloqueio');
  assert.strictEqual(inspection.pageType, 'WAF_PAGE');
});

test('MercadoLivrePageClassifier - Detecção de CAPTCHA', async () => {
  const classifier = new MercadoLivrePageClassifier();
  const mockPage = {
    title: async () => 'Robot Check',
    content: async () => '<html><body>Please check this box.</body></html>',
    url: () => 'https://www.mercadolivre.com.br/captcha',
    evaluate: async () => null
  };
  const mockNavigatorPage = {
    getRawPage: () => mockPage
  } as unknown as INavigatorPage;

  const inspection = await classifier.classify(mockNavigatorPage, 'https://www.mercadolivre.com.br/captcha');
  assert.strictEqual(inspection.pageType, 'CAPTCHA_PAGE');
});

test('MercadoLivrePageClassifier - Detecção de Login', async () => {
  const classifier = new MercadoLivrePageClassifier();
  const mockPage = {
    title: async () => 'Sessão',
    content: async () => '<html><body>Login Form</body></html>',
    url: () => 'https://www.mercadolivre.com.br/ap/signin',
    evaluate: async () => null
  };
  const mockNavigatorPage = {
    getRawPage: () => mockPage
  } as unknown as INavigatorPage;

  const inspection = await classifier.classify(mockNavigatorPage, 'https://www.mercadolivre.com.br/ap/signin');
  assert.strictEqual(inspection.pageType, 'LOGIN_PAGE');
});

test('MercadoLivrePageClassifier - Detecção de Landing de Afiliado', async () => {
  const classifier = new MercadoLivrePageClassifier();
  const mockPage = {
    title: async () => 'Social Hub',
    content: async () => '<html><body>Botão Ir para o produto</body></html>',
    url: () => 'https://www.mercadolivre.com.br/social/xaviertech',
    evaluate: async (fn: any) => {
      const fnStr = fn.toString();
      if (fnStr.includes('data-testid*="product"')) {
        return true;
      }
      return false;
    }
  };
  const mockNavigatorPage = {
    getRawPage: () => mockPage
  } as unknown as INavigatorPage;

  const inspection = await classifier.classify(mockNavigatorPage, 'https://www.mercadolivre.com.br/social/xaviertech');
  assert.strictEqual(inspection.pageType, 'AFFILIATE_LANDING');
  assert.strictEqual(inspection.hasCTA, true);
});

test('MercadoLivrePageClassifier - Detecção de PDP com alta confiança', async () => {
  const classifier = new MercadoLivrePageClassifier();
  const mockPage = {
    title: async () => 'Fone Bluetooth',
    content: async () => '<html><body>Produto Real</body></html>',
    url: () => 'https://produto.mercadolivre.com.br/MLB-12345-fone',
    evaluate: async (fn: any) => {
      const fnStr = fn.toString();
      if (fnStr.includes('rel="canonical"')) {
        return 'https://produto.mercadolivre.com.br/MLB-12345-fone';
      }
      if (fnStr.includes('h1.ui-pdp-title')) {
        return true;
      }
      if (fnStr.includes('.ui-pdp-actions')) {
        return true;
      }
      if (fnStr.includes('img.ui-pdp-gallery__figure__image')) {
        return true;
      }
      return false;
    }
  };
  const mockNavigatorPage = {
    getRawPage: () => mockPage
  } as unknown as INavigatorPage;

  const inspection = await classifier.classify(mockNavigatorPage, 'https://produto.mercadolivre.com.br/MLB-12345-fone');
  assert.strictEqual(inspection.pageType, 'PRODUCT_PAGE');
  assert.strictEqual(inspection.hasMLB, true);
  assert.strictEqual(inspection.hasProductImage, true);
  assert.strictEqual(inspection.hasBuyBox, true);
});

test('MercadoLivrePageClassifier - Detecção de Página de Erro estrutural', async () => {
  const classifier = new MercadoLivrePageClassifier();
  const mockPage = {
    title: async () => 'Erro - Página não encontrada',
    content: async () => '<html><body>Não encontramos essa página.</body></html>',
    url: () => 'https://www.mercadolivre.com.br/nao-encontrado',
    evaluate: async (fn: any) => {
      const fnStr = fn.toString();
      if (fnStr.includes('andes-placeholder__title')) {
        return true;
      }
      return false;
    }
  };
  const mockNavigatorPage = {
    getRawPage: () => mockPage
  } as unknown as INavigatorPage;

  const inspection = await classifier.classify(mockNavigatorPage, 'https://www.mercadolivre.com.br/nao-encontrado');
  assert.strictEqual(inspection.pageType, 'ERROR_PAGE');
});
