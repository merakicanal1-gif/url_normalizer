import test from 'node:test';
import assert from 'node:assert';
import { AffiliateLinkGenerator } from './AffiliateLinkGenerator.js';

test('AffiliateLinkGenerator - Amazon affiliate URLs', () => {
  process.env.AMAZON_AFFILIATE_TAG = 'custom-tag-20';
  const generator = new AffiliateLinkGenerator();
  const res = generator.generate('amazon', 'https://www.amazon.com.br/dp/B0DJFRHR1G', 'B0DJFRHR1G');
  assert.strictEqual(res, null);
});

test('AffiliateLinkGenerator - Mercado Livre affiliate URLs', () => {
  process.env.MERCADOLIVRE_AFFILIATE_TAG = 'ml-tag-123';
  const generator = new AffiliateLinkGenerator();
  const res = generator.generate('mercadolivre', 'https://www.mercadolivre.com.br/p/MLB1234567', 'MLB1234567');
  assert.strictEqual(res, 'https://www.mercadolivre.com.br/p/MLB1234567?afiliado=ml-tag-123');
});

test('AffiliateLinkGenerator - fallback/other marketplaces', () => {
  const generator = new AffiliateLinkGenerator();
  const res = generator.generate('shopee', 'https://shopee.com.br/product-123', '123');
  assert.strictEqual(res, null);
});
