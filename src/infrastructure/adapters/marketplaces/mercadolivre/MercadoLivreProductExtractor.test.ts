import test from 'node:test';
import assert from 'node:assert';
import { MercadoLivreProductExtractor } from './MercadoLivreProductExtractor.js';
import { INavigatorPage } from '../../../../domain/ports/INavigator.js';

const mockLogger = {
  info: () => {},
  error: () => {}
};

test('MercadoLivreProductExtractor - Extraction success', async () => {
  const extractor = new MercadoLivreProductExtractor(mockLogger);

  const mockPage = {
    evaluate: async (fn: any) => {
      const fnStr = fn.toString();
      if (fnStr.includes('rel="canonical"')) {
        return 'https://produto.mercadolivre.com.br/MLB-12345-fone';
      }
      return null;
    }
  };

  const mockNavigatorPage = {
    getRawPage: () => mockPage,
    evaluate: async () => {
      return {
        title: 'Fone Bluetooth Extraído',
        image: 'https://m.media.com/fone.jpg',
        currentPriceText: '199.90',
        previousPriceText: '249.90'
      };
    }
  } as unknown as INavigatorPage;

  const result = await extractor.extract(mockNavigatorPage, 'https://produto.mercadolivre.com.br/MLB-12345-fone', 'mercadolivre');
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.id_produto, 'MLB12345');
  assert.strictEqual(result.nome_produto, 'Fone Bluetooth Extraído');
  assert.strictEqual(result.url_imagem, 'https://m.media.com/fone.jpg');
  assert.strictEqual(result.preco_atual, 199.90);
  assert.strictEqual(result.preco_anterior, 249.90);
});

test('MercadoLivreProductExtractor - Fluxo de afiliados de sucesso', async () => {
  const extractor = new MercadoLivreProductExtractor(mockLogger);

  let clickedShare = false;
  let clickedCopy = false;
  let permissionsGranted = false;

  const mockLocator = (selector: string): any => {
    return {
      count: async () => {
        if (selector.includes('Afiliados')) return 1;
        if (selector.includes('Compartilhar')) return 1;
        if (selector.includes('Copiar')) return 1;
        return 1;
      },
      isVisible: async () => true,
      first: () => mockLocator(selector),
      waitFor: async () => {},
      click: async () => {
        if (selector.includes('Compartilhar')) clickedShare = true;
        if (selector.includes('Copiar')) clickedCopy = true;
      },
      locator: (subSelector: string) => mockLocator(selector + ' ' + subSelector)
    };
  };

  const mockPage = {
    evaluate: async (fn: any) => {
      const fnStr = fn.toString();
      if (fnStr.includes('navigator.clipboard.readText')) {
        return 'https://meli.la/abc123aff';
      }
      if (fnStr.includes('rel="canonical"')) {
        return 'https://produto.mercadolivre.com.br/MLB-12345-fone';
      }
      return null;
    },
    locator: mockLocator,
    content: async () => '<html></html>',
    context: () => ({
      grantPermissions: async (perms: string[]) => {
        if (perms.includes('clipboard-read')) permissionsGranted = true;
      }
    }),
    waitForTimeout: async () => {}
  };

  const mockNavigatorPage = {
    getRawPage: () => mockPage,
    evaluate: async () => {
      return {
        title: 'Fone Bluetooth Extraído',
        image: 'https://m.media.com/fone.jpg',
        currentPriceText: '199.90',
        previousPriceText: '249.90'
      };
    }
  } as unknown as INavigatorPage;

  const result = await extractor.extract(mockNavigatorPage, 'https://produto.mercadolivre.com.br/MLB-12345-fone', 'mercadolivre');
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.link_afiliado, 'https://meli.la/abc123aff');
  assert.strictEqual(clickedShare, true);
  assert.strictEqual(clickedCopy, true);
  assert.strictEqual(permissionsGranted, true);
});

test('MercadoLivreProductExtractor - Lanca erro se a barra de afiliados nao for localizada', async () => {
  const extractor = new MercadoLivreProductExtractor(mockLogger);

  const mockLocator = (selector: string): any => {
    return {
      count: async () => 0,
      isVisible: async () => false,
      first: () => mockLocator(selector),
      waitFor: async () => {}
    };
  };

  const mockPage = {
    evaluate: async (fn: any) => {
      const fnStr = fn.toString();
      if (fnStr.includes('rel="canonical"')) {
        return 'https://produto.mercadolivre.com.br/MLB-12345-fone';
      }
      return null;
    },
    locator: mockLocator,
    content: async () => '<html></html>',
    waitForTimeout: async () => {}
  };

  const mockNavigatorPage = {
    getRawPage: () => mockPage,
    evaluate: async () => {
      return {
        title: 'Fone Bluetooth Extraído',
        image: 'https://m.media.com/fone.jpg',
        currentPriceText: '199.90',
        previousPriceText: '249.90'
      };
    }
  } as unknown as INavigatorPage;

  await assert.rejects(
    async () => {
      await extractor.extract(mockNavigatorPage, 'https://produto.mercadolivre.com.br/MLB-12345-fone', 'mercadolivre');
    },
    (err: any) => {
      assert.strictEqual(err.name, 'AffiliateLinkError');
      assert.strictEqual(err.message, 'Não foi possível gerar ou capturar o link oficial de afiliado do Mercado Livre.');
      return true;
    }
  );
});
