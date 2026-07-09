import test from 'node:test';
import assert from 'node:assert';
import { MercadoLivrePlugin } from './MercadoLivrePlugin.js';
import { AmazonPlugin } from './AmazonPlugin.js';
import { ShopeePlugin } from './ShopeePlugin.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';
import { ChallengeDetectedError } from '../../../domain/errors/ChallengeDetectedError.js';
import { MarketplaceUnavailableError } from '../../../domain/errors/MarketplaceUnavailableError.js';

const mockLogger = {
  info: () => {},
  error: () => {}
};

// ==========================================
// TESTES DO MERCADO LIVRE
// ==========================================

test('MercadoLivrePlugin - landing válida (recuperação por clique)', async () => {
  const plugin = new MercadoLivrePlugin(mockLogger);
  let clickCalled = false;
  let waitForNavigationCalled = false;

  const mockRawPage = {
    url: () => 'https://produto.mercadolivre.com.br/MLB-3382755259-fone',
    title: async () => 'Fone de Ouvido Bluetooth',
    content: async () => '<html><title>Fone de Ouvido Bluetooth</title></html>',
    screenshot: async () => Buffer.from(''),
    locator: (_selector: string) => ({
      filter: () => ({
        count: async () => 1, // Encontra o botão
        first: () => ({
          isVisible: async () => true,
          isEnabled: async () => true,
          evaluate: async () => ({
            tagName: 'A',
            href: 'https://produto.mercadolivre.com.br/MLB-3382755259-fone',
            target: '',
            onclick: ''
          }),
          click: async () => {
            clickCalled = true;
          }
        })
      })
    }),
    waitForNavigation: async () => {
      waitForNavigationCalled = true;
    },
    waitForTimeout: async () => {},
    context: () => ({ on: () => {} }),
    on: () => {}
  };

  const mockNavigatorPage: INavigatorPage = {
    getRawPage: () => mockRawPage,
    evaluate: async () => ({ title: 'Fone de Ouvido Bluetooth', image: 'https://m.media.com/fone.jpg' }),
    close: async () => {}
  } as unknown as INavigatorPage;

  const result = await plugin.normalize(mockNavigatorPage, new URL('https://www.mercadolivre.com.br/social/xaviertech'));

  assert.strictEqual(clickCalled, true);
  assert.strictEqual(waitForNavigationCalled, true);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.id_produto, 'MLB3382755259');
});

test('MercadoLivrePlugin - landing com erro (ERROR_PAGE)', async () => {
  const plugin = new MercadoLivrePlugin(mockLogger);

  const mockRawPage = {
    url: () => 'https://www.mercadolivre.com.br/social/xaviertech',
    title: async () => 'Error',
    content: async () => '<html><body>Hubo un error accediendo a esta pagina e Ir a la página principal</body></html>',
    screenshot: async () => Buffer.from(''),
    locator: (_selector: string) => ({
      filter: () => ({
        count: async () => 0,
        first: () => ({})
      })
    }),
    context: () => ({ on: () => {} }),
    on: () => {}
  };

  const mockNavigatorPage: INavigatorPage = {
    getRawPage: () => mockRawPage,
    evaluate: async () => ({ title: '', image: '' }),
    close: async () => {}
  } as unknown as INavigatorPage;

  await assert.rejects(
    async () => {
      await plugin.normalize(mockNavigatorPage, new URL('https://www.mercadolivre.com.br/social/xaviertech'));
    },
    (err: any) => {
      assert.strictEqual(err.name, 'MarketplaceUnavailableError');
      assert.strictEqual(err.pageType, 'ERROR_PAGE');
      return true;
    }
  );
});

test('MercadoLivrePlugin - página de produto', async () => {
  const plugin = new MercadoLivrePlugin(mockLogger);

  const mockRawPage = {
    url: () => 'https://produto.mercadolivre.com.br/MLB-3382755259-fone',
    title: async () => 'Fone de Ouvido Bluetooth',
    content: async () => '<html><body>Produto Real</body></html>',
    screenshot: async () => Buffer.from(''),
    locator: (_selector: string) => ({
      filter: () => ({
        count: async () => 0,
        first: () => ({})
      })
    }),
    context: () => ({ on: () => {} }),
    on: () => {}
  };

  const mockNavigatorPage: INavigatorPage = {
    getRawPage: () => mockRawPage,
    evaluate: async () => ({ title: 'Fone de Ouvido Bluetooth', image: 'https://m.media.com/fone.jpg' }),
    close: async () => {}
  } as unknown as INavigatorPage;

  const result = await plugin.normalize(mockNavigatorPage, new URL('https://produto.mercadolivre.com.br/MLB-3382755259-fone'));
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.id_produto, 'MLB3382755259');
});

test('MercadoLivrePlugin - página inexistente (sem MLB)', async () => {
  const plugin = new MercadoLivrePlugin(mockLogger);

  const mockRawPage = {
    url: () => 'https://www.mercadolivre.com.br/categoria/eletronicos',
    title: async () => 'Eletrônicos',
    content: async () => '<html><body>Categoria</body></html>',
    screenshot: async () => Buffer.from(''),
    locator: (_selector: string) => ({
      filter: () => ({
        count: async () => 0,
        first: () => ({})
      })
    }),
    context: () => ({ on: () => {} }),
    on: () => {}
  };

  const mockNavigatorPage: INavigatorPage = {
    getRawPage: () => mockRawPage,
    evaluate: async () => ({ title: '', image: '' }),
    close: async () => {}
  } as unknown as INavigatorPage;

  await assert.rejects(
    async () => {
      await plugin.normalize(mockNavigatorPage, new URL('https://www.mercadolivre.com.br/categoria/eletronicos'));
    },
    /Não foi possível identificar o código/
  );
});

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
    evaluate: async () => ({ title: 'iPhone 16 Pro Max', image: 'https://m.media.com/iphone.jpg' }),
    close: async () => {}
  } as unknown as INavigatorPage;

  const result = await plugin.normalize(mockNavigatorPage, new URL('https://www.amazon.com.br/dp/B0DJFRHR1G'));
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.id_produto, 'B0DJFRHR1G');
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
