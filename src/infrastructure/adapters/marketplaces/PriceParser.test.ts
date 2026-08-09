import test from 'node:test';
import assert from 'node:assert';
import { parsePrice } from './PriceParser.js';

test('PriceParser - Brazilian format', () => {
  assert.strictEqual(parsePrice('R$ 1.249,90'), 1249.90);
  assert.strictEqual(parsePrice('R$ 199,90'), 199.90);
  assert.strictEqual(parsePrice('199,90'), 199.90);
  assert.strictEqual(parsePrice('   R$\t9,99  '), 9.99);
});

test('PriceParser - US format', () => {
  assert.strictEqual(parsePrice('1,249.90'), 1249.90);
  assert.strictEqual(parsePrice('$199.90'), 199.90);
  assert.strictEqual(parsePrice('199.90'), 199.90);
});

test('PriceParser - null or invalid inputs', () => {
  assert.strictEqual(parsePrice(null), null);
  assert.strictEqual(parsePrice(undefined), null);
  assert.strictEqual(parsePrice(''), null);
  assert.strictEqual(parsePrice('grátis'), null);
});
