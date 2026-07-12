import test from 'node:test';
import assert from 'node:assert';
import { PlaywrightNavigationObserver } from './PlaywrightNavigationObserver.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';

const mockLogger = {
  info: () => {},
  error: () => {}
};

test('PlaywrightNavigationObserver - URL change matches first', async () => {
  const observer = new PlaywrightNavigationObserver(mockLogger);
  let checkCount = 0;

  const mockPage = {
    url: () => {
      checkCount++;
      return checkCount > 2
        ? 'https://produto.mercadolivre.com.br/MLB-12345-fone'
        : 'https://www.mercadolivre.com.br/social/xaviertech';
    },
    waitForSelector: async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return {};
    },
    waitForNavigation: async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  };

  const mockNavigatorPage = {
    getRawPage: () => mockPage
  } as unknown as INavigatorPage;

  const result = await observer.waitForTransition(mockNavigatorPage);
  assert.strictEqual(result, 'url_changed_product');
});

test('PlaywrightNavigationObserver - Selector visible first', async () => {
  const observer = new PlaywrightNavigationObserver(mockLogger);

  const mockPage = {
    url: () => 'https://www.mercadolivre.com.br/social/xaviertech',
    waitForSelector: async () => {
      return {};
    },
    waitForNavigation: async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  };

  const mockNavigatorPage = {
    getRawPage: () => mockPage
  } as unknown as INavigatorPage;

  const result = await observer.waitForTransition(mockNavigatorPage);
  assert.strictEqual(result, 'pdp_element_visible');
});
