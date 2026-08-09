import test from 'node:test';
import assert from 'node:assert';
import { AmazonPlugin } from './AmazonPlugin.js';
import { ShopeePlugin } from './ShopeePlugin.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';

const mockLogger = {
  info: () => {},
  error: () => {}
};

// ==========================================
// TESTES DA AMAZON
// ==========================================

test('AmazonPlugin - produto', async () => {
  const plugin = new AmazonPlugin(mockLogger);

  const mockRawPage = {
    url: () => 'https://www.amazon.com.br/dp/B0DJFRHR1G',
    title: async () => 'iPhone 16 Pro Max',
    content: async () => '<html><body>Amazon Product</body></html>',
    screenshot: async () => Buffer.from('')
  };

  const mockNavigatorPage: INavigatorPage = {
    getRawPage: () => mockRawPage,
    evaluate: async () => ({ 
      title: 'iPhone 16 Pro Max', 
      image: 'https://m.media.com/iphone.jpg',
      currentPriceText: '199.90',
      previousPriceText: '249.90'
    }),
    close: async () => {}
  } as unknown as INavigatorPage;

  const result = await plugin.normalize(mockNavigatorPage, new URL('https://www.amazon.com.br/dp/B0DJFRHR1G'));
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.id_produto, 'B0DJFRHR1G');
  assert.strictEqual(result.nome_produto, 'iPhone 16 Pro Max');
  assert.strictEqual(result.url_imagem, 'https://m.media.com/iphone.jpg');
  assert.strictEqual(result.preco_atual, 199.90);
  assert.strictEqual(result.preco_anterior, 249.90);
});

test('AmazonPlugin - WAF', async () => {
  const plugin = new AmazonPlugin(mockLogger);

  const mockRawPage = {
    url: () => 'https://www.amazon.com.br/dp/B0DJFRHR1G',
    title: async () => 'AWS WAF Challenge',
    content: async () => '<html><body>token.awswaf.com block screen</body></html>',
    screenshot: async () => Buffer.from('')
  };

  const mockNavigatorPage: INavigatorPage = {
    getRawPage: () => mockRawPage,
    evaluate: async () => ({ title: '', image: '' }),
    close: async () => {}
  } as unknown as INavigatorPage;

  await assert.rejects(
    async () => {
      await plugin.normalize(mockNavigatorPage, new URL('https://www.amazon.com.br/dp/B0DJFRHR1G'));
    },
    (err: any) => {
      assert.strictEqual(err.name, 'ChallengeDetectedError');
      assert.strictEqual(err.type, 'WAF');
      return true;
    }
  );
});

// ==========================================
// TESTES DA SHOPEE
// ==========================================

test('ShopeePlugin - canHandle', () => {
  const plugin = new ShopeePlugin(mockLogger);
  assert.strictEqual(plugin.canHandle(new URL('https://shopee.com.br/product-i.123.456')), true);
  assert.strictEqual(plugin.canHandle(new URL('https://shopee.com/product-i.123.456')), true);
  assert.strictEqual(plugin.canHandle(new URL('https://s.shopee.com.br/2BD1NtkJLh')), true);
  assert.strictEqual(plugin.canHandle(new URL('https://br.shp.ee/2BD1NtkJLh')), true);
  assert.strictEqual(plugin.canHandle(new URL('https://mall.shopee.com.br/product-i.123.456')), true);
  assert.strictEqual(plugin.canHandle(new URL('https://www.google.com')), false);
});

test('ShopeePlugin - produto', async () => {
  const plugin = new ShopeePlugin(mockLogger);

  const mockRawPage = {
    url: () => 'https://shopee.com.br/product-i.123456.789012',
    title: async () => 'Shopee Product Title',
    content: async () => '<html><body>Shopee Product</body></html>',
    screenshot: async () => Buffer.from('')
  };

  const mockNavigatorPage: INavigatorPage = {
    getRawPage: () => mockRawPage,
    evaluate: async () => ({ title: 'Shopee Product Title', image: 'https://m.media.com/shopee.jpg' }),
    close: async () => {}
  } as unknown as INavigatorPage;

  const result = await plugin.normalize(mockNavigatorPage, new URL('https://shopee.com.br/product-i.123456.789012'));
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.id_produto, '123456.789012');
});

test('ShopeePlugin - login', async () => {
  const plugin = new ShopeePlugin(mockLogger);

  const mockRawPage = {
    url: () => 'https://shopee.com.br/buyer/login',
    title: async () => 'Login Shopee',
    content: async () => '<html><body>shopee-login-page login form</body></html>',
    screenshot: async () => Buffer.from('')
  };

  const mockNavigatorPage: INavigatorPage = {
    getRawPage: () => mockRawPage,
    evaluate: async () => ({ title: '', image: '' }),
    close: async () => {}
  } as unknown as INavigatorPage;

  await assert.rejects(
    async () => {
      await plugin.normalize(mockNavigatorPage, new URL('https://shopee.com.br/buyer/login'));
    },
    (err: any) => {
      assert.strictEqual(err.name, 'ChallengeDetectedError');
      assert.strictEqual(err.type, 'LOGIN');
      return true;
    }
  );
});

test('ShopeePlugin - erro', async () => {
  const plugin = new ShopeePlugin(mockLogger);

  const mockRawPage = {
    url: () => 'https://shopee.com.br/product-i.123456.789012',
    title: async () => '403 Forbidden',
    content: async () => '<html><body>Access Forbidden blocked by shopee</body></html>',
    screenshot: async () => Buffer.from('')
  };

  const mockNavigatorPage: INavigatorPage = {
    getRawPage: () => mockRawPage,
    evaluate: async () => ({ title: '', image: '' }),
    close: async () => {}
  } as unknown as INavigatorPage;

  await assert.rejects(
    async () => {
      await plugin.normalize(mockNavigatorPage, new URL('https://shopee.com.br/product-i.123456.789012'));
    },
    (err: any) => {
      assert.strictEqual(err.name, 'MarketplaceUnavailableError');
      assert.strictEqual(err.pageType, 'ERROR_PAGE');
      return true;
    }
  );
});
