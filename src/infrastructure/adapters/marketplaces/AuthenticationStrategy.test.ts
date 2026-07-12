import { test } from 'node:test';
import assert from 'node:assert';
import { IPageInspector, Cookie } from '../../../domain/ports/IPageInspector.js';
import { AmazonAuthenticationStrategy } from './AmazonAuthenticationStrategy.js';
import { MercadoLivreAuthenticationStrategy } from './MercadoLivreAuthenticationStrategy.js';
import { ShopeeAuthenticationStrategy } from './ShopeeAuthenticationStrategy.js';
import { GenericAuthenticationStrategy } from './GenericAuthenticationStrategy.js';

class MockPageInspector implements IPageInspector {
  constructor(
    private currentUrl: string,
    private currentCookies: Cookie[],
    private visibleSelectors: string[] = [],
    private textContent: Record<string, string> = {}
  ) {}

  public async url(): Promise<string> {
    return this.currentUrl;
  }

  public async cookies(): Promise<Cookie[]> {
    return this.currentCookies;
  }

  public async text(selector: string): Promise<string | null> {
    return this.textContent[selector] || null;
  }

  public async exists(selector: string): Promise<boolean> {
    return this.visibleSelectors.includes(selector);
  }
}

// Cookies válidos para passar na Etapa 1
const amazonValidCookies: Cookie[] = [
  { name: 'x-main', value: '1', domain: '.amazon.com.br', path: '/', expires: 0, httpOnly: false, secure: true, sameSite: 'Lax' },
  { name: 'at-main', value: '2', domain: '.amazon.com.br', path: '/', expires: 0, httpOnly: false, secure: true, sameSite: 'Lax' },
  { name: 'session-token', value: '3', domain: '.amazon.com.br', path: '/', expires: 0, httpOnly: false, secure: true, sameSite: 'Lax' }
];

const mlValidCookies: Cookie[] = [
  { name: 'sid', value: '1', domain: '.mercadolivre.com.br', path: '/', expires: 0, httpOnly: false, secure: true, sameSite: 'Lax' }
];

const shopeeValidCookies: Cookie[] = [
  { name: 'shopee_token', value: '1', domain: '.shopee.com.br', path: '/', expires: 0, httpOnly: false, secure: true, sameSite: 'Lax' }
];

// ----------------------------------------------------
// 1. AmazonAuthenticationStrategy Tests
// ----------------------------------------------------
test('AmazonAuthenticationStrategy - VALID session (cookies + user greeting menu)', async () => {
  const strategy = new AmazonAuthenticationStrategy();
  const inspector = new MockPageInspector(
    'https://www.amazon.com.br/gp/css/homepage.html',
    amazonValidCookies,
    ['#nav-link-accountList-nav-line-1'],
    { '#nav-link-accountList-nav-line-1': 'Olá, Emerson' }
  );

  const result = await strategy.detect(inspector);
  assert.strictEqual(result.authenticated, true);
  assert.strictEqual(result.status, 'VALID');
  assert.strictEqual(result.confidence, 1.0);
  assert.strictEqual(result.strategyVersion, 1);
  assert.match(result.summary, /session is valid/i);
  assert.ok(result.evidence.some(e => e.type === 'cookie' && e.value === 'x-main'));
  assert.ok(result.evidence.some(e => e.type === 'selector' && e.value === '#nav-link-accountList-nav-line-1'));
});

test('AmazonAuthenticationStrategy - cookies present + user deslogado (greet login text)', async () => {
  const strategy = new AmazonAuthenticationStrategy();
  const inspector = new MockPageInspector(
    'https://www.amazon.com.br/gp/css/homepage.html',
    amazonValidCookies,
    ['#nav-link-accountList-nav-line-1'],
    { '#nav-link-accountList-nav-line-1': 'Olá, faça seu login' }
  );

  const result = await strategy.detect(inspector);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.status, 'LOGIN_REQUIRED');
  assert.strictEqual(result.confidence, 0.85);
});

test('AmazonAuthenticationStrategy - login page (URL + input fields)', async () => {
  const strategy = new AmazonAuthenticationStrategy();
  
  // URL check
  const inspectorUrl = new MockPageInspector(
    'https://www.amazon.com.br/ap/signin?openid.pape.max_auth_age=0',
    amazonValidCookies
  );
  let result = await strategy.detect(inspectorUrl);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.status, 'LOGIN_REQUIRED');
  assert.strictEqual(result.confidence, 1.0);
  assert.ok(result.evidence.some(e => e.type === 'url' && e.value.includes('/ap/signin')));

  // Selector check
  const inspectorSelector = new MockPageInspector(
    'https://www.amazon.com.br/some-page',
    amazonValidCookies,
    ['#ap_email']
  );
  result = await strategy.detect(inspectorSelector);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.status, 'LOGIN_REQUIRED');
  assert.strictEqual(result.confidence, 0.95);
  assert.ok(result.evidence.some(e => e.type === 'selector' && e.value === '#ap_email'));
});

test('AmazonAuthenticationStrategy - CAPTCHA page (URL and DOM)', async () => {
  const strategy = new AmazonAuthenticationStrategy();
  
  // URL check
  const inspectorUrl = new MockPageInspector(
    'https://www.amazon.com.br/errors/validatecaptcha',
    amazonValidCookies
  );
  let result = await strategy.detect(inspectorUrl);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.status, 'CAPTCHA_REQUIRED');
  assert.strictEqual(result.confidence, 1.0);

  // Selector check
  const inspectorSelector = new MockPageInspector(
    'https://www.amazon.com.br/some-page',
    amazonValidCookies,
    ['#captchacharacters']
  );
  result = await strategy.detect(inspectorSelector);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.status, 'CAPTCHA_REQUIRED');
  assert.strictEqual(result.confidence, 0.95);
});

test('AmazonAuthenticationStrategy - storageState invalid / cookies missing', async () => {
  const strategy = new AmazonAuthenticationStrategy();
  const inspector = new MockPageInspector(
    'https://www.amazon.com.br/gp/css/homepage.html',
    []
  );

  const result = await strategy.detect(inspector);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.status, 'MISSING');
  assert.strictEqual(result.confidence, 1.0);
  assert.match(result.reason, /missing required Amazon cookies/i);
});

test('AmazonAuthenticationStrategy - VALID session with degraded cookie integrity (DOM_FIRST)', async () => {
  const strategy = new AmazonAuthenticationStrategy();
  const inspector = new MockPageInspector(
    'https://www.amazon.com.br/gp/css/homepage.html',
    [], // Nenhum cookie presente
    ['#nav-link-accountList-nav-line-1'],
    { '#nav-link-accountList-nav-line-1': 'Olá, Emerson' }
  );

  const result = await strategy.detect(inspector);
  assert.strictEqual(result.authenticated, true);
  assert.strictEqual(result.status, 'VALID');
  assert.match(result.reason, /Visual authenticated session detected. Cookie integrity degraded/i);
  assert.ok(result.evidence.some(e => e.type === 'warning' && e.value.includes('Cookie integrity degraded')));
});


// ----------------------------------------------------
// 2. MercadoLivreAuthenticationStrategy Tests
// ----------------------------------------------------
test('MercadoLivreAuthenticationStrategy - VALID session', async () => {
  const strategy = new MercadoLivreAuthenticationStrategy();
  const inspector = new MockPageInspector(
    'https://www.mercadolivre.com.br/',
    mlValidCookies,
    ['.nav-header-username'],
    { '.nav-header-username': 'Emerson' }
  );

  const result = await strategy.detect(inspector);
  assert.strictEqual(result.authenticated, true);
  assert.strictEqual(result.status, 'VALID');
  assert.strictEqual(result.confidence, 1.0);
});

test('MercadoLivreAuthenticationStrategy - cookies present + user deslogado', async () => {
  const strategy = new MercadoLivreAuthenticationStrategy();
  const inspector = new MockPageInspector(
    'https://www.mercadolivre.com.br/',
    mlValidCookies,
    ['a[href*="/login"]'],
    {}
  );

  const result = await strategy.detect(inspector);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.status, 'LOGIN_REQUIRED');
});

test('MercadoLivreAuthenticationStrategy - CAPTCHA detected', async () => {
  const strategy = new MercadoLivreAuthenticationStrategy();
  const inspector = new MockPageInspector(
    'https://www.mercadolivre.com.br/captcha?verify=true',
    mlValidCookies
  );

  const result = await strategy.detect(inspector);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.status, 'CAPTCHA_REQUIRED');
});

test('MercadoLivreAuthenticationStrategy - missing cookies', async () => {
  const strategy = new MercadoLivreAuthenticationStrategy();
  const inspector = new MockPageInspector(
    'https://www.mercadolivre.com.br/',
    []
  );

  const result = await strategy.detect(inspector);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.status, 'MISSING');
});

// ----------------------------------------------------
// 3. ShopeeAuthenticationStrategy Tests
// ----------------------------------------------------
test('ShopeeAuthenticationStrategy - VALID session', async () => {
  const strategy = new ShopeeAuthenticationStrategy();
  const inspector = new MockPageInspector(
    'https://shopee.com.br/',
    shopeeValidCookies,
    ['.navbar__username'],
    { '.navbar__username': 'Emerson' }
  );

  const result = await strategy.detect(inspector);
  assert.strictEqual(result.authenticated, true);
  assert.strictEqual(result.status, 'VALID');
  assert.strictEqual(result.confidence, 1.0);
});

test('ShopeeAuthenticationStrategy - login input visible', async () => {
  const strategy = new ShopeeAuthenticationStrategy();
  const inspector = new MockPageInspector(
    'https://shopee.com.br/',
    shopeeValidCookies,
    ['input[type="password"]']
  );

  const result = await strategy.detect(inspector);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.status, 'LOGIN_REQUIRED');
  assert.strictEqual(result.confidence, 0.90);
});

test('ShopeeAuthenticationStrategy - CAPTCHA detected', async () => {
  const strategy = new ShopeeAuthenticationStrategy();
  const inspector = new MockPageInspector(
    'https://shopee.com.br/security-check',
    shopeeValidCookies
  );

  const result = await strategy.detect(inspector);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.status, 'CAPTCHA_REQUIRED');
});

// ----------------------------------------------------
// 4. GenericAuthenticationStrategy Tests
// ----------------------------------------------------
test('GenericAuthenticationStrategy - always returns UNKNOWN', async () => {
  const strategy = new GenericAuthenticationStrategy();
  const inspector = new MockPageInspector(
    'about:blank',
    []
  );

  const result = await strategy.detect(inspector);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.status, 'INVALID');
});

// ----------------------------------------------------
// 5. Exception safety check (Base class protection)
// ----------------------------------------------------
test('BaseAuthenticationStrategy - catches exceptions and returns INVALID result without throwing', async () => {
  const strategy = new AmazonAuthenticationStrategy();
  const throwingInspector: IPageInspector = {
    url: async () => { throw new Error('Network timeout'); },
    cookies: async () => [],
    text: async () => null,
    exists: async () => false
  };

  const result = await strategy.detect(throwingInspector);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.status, 'INVALID');
  assert.strictEqual(result.confidence, 0);
  assert.match(result.reason, /network timeout/i);
  assert.strictEqual(result.evidence[0].type, 'error');
});
