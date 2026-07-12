import test from 'node:test';
import assert from 'node:assert';
import { MercadoLivreProductPageValidator } from './MercadoLivreProductPageValidator.js';
import { PageInspection } from '../../../../domain/models/PageInspection.js';

test('MercadoLivreProductPageValidator - Confidence scoring', async () => {
  const validator = new MercadoLivreProductPageValidator(70);

  // 1. Caso perfeito (100 de confiança)
  const perfectInspection: PageInspection = {
    pageType: 'PRODUCT_PAGE',
    confidence: 0,
    url: 'https://produto.mercadolivre.com.br/MLB-12345-fone',
    title: 'Fone Bluetooth',
    hasCTA: false,
    hasProductImage: true,
    hasBuyBox: true,
    hasMLB: true,
    evidences: ['Product title element found']
  };

  const res1 = await validator.validate(perfectInspection);
  assert.strictEqual(res1.isValid, true);
  assert.strictEqual(res1.confidence, 100);

  // 2. Caso limiar (70 de confiança: MLB=40, Title=30)
  const thresholdInspection: PageInspection = {
    pageType: 'UNKNOWN',
    confidence: 0,
    url: 'https://produto.mercadolivre.com.br/MLB-12345-fone',
    title: 'Fone Bluetooth',
    hasCTA: false,
    hasProductImage: false,
    hasBuyBox: false,
    hasMLB: true,
    evidences: ['Product title element found']
  };

  const res2 = await validator.validate(thresholdInspection);
  assert.strictEqual(res2.isValid, true);
  assert.strictEqual(res2.confidence, 70);

  // 3. Caso insuficiente (60 de confiança: MLB=40, Image=20)
  const lowInspection: PageInspection = {
    pageType: 'UNKNOWN',
    confidence: 0,
    url: 'https://produto.mercadolivre.com.br/MLB-12345-fone',
    title: 'Fone Bluetooth',
    hasCTA: false,
    hasProductImage: true,
    hasBuyBox: false,
    hasMLB: true,
    evidences: []
  };

  const res3 = await validator.validate(lowInspection);
  assert.strictEqual(res3.isValid, false);
  assert.strictEqual(res3.confidence, 60);
});
