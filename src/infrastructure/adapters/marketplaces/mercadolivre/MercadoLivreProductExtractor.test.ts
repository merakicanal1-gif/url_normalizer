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
        image: 'https://m.media.com/fone.jpg'
      };
    }
  } as unknown as INavigatorPage;

  const result = await extractor.extract(mockNavigatorPage, 'https://produto.mercadolivre.com.br/MLB-12345-fone', 'mercadolivre');
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.id_produto, 'MLB12345');
  assert.strictEqual(result.titulo, 'Fone Bluetooth Extraído');
  assert.strictEqual(result.imagem, 'https://m.media.com/fone.jpg');
});
