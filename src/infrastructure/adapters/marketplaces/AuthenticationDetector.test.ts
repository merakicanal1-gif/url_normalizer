import { test } from 'node:test';
import assert from 'node:assert';
import { AmazonAuthenticationDetector } from './AmazonAuthenticationDetector.js';
import { IPageInspector, Cookie } from '../../../domain/ports/IPageInspector.js';
import { AuthenticationDetectionContext } from '../../../domain/ports/IAuthenticationDetector.js';

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

test('AmazonAuthenticationDetector - detect on login page URL', async () => {
  const inspector = new MockPageInspector(
    'https://www.amazon.com.br/ap/signin?openid.pape.max_auth_age=0',
    []
  );
  const detector = new AmazonAuthenticationDetector();
  const context: AuthenticationDetectionContext = {
    marketplace: 'amazon',
    pageInspector: inspector,
    startedAt: new Date().toISOString(),
    sessionId: 'session-1',
    profileId: 'profile-1',
    requestId: 'req-1',
    traceId: 'trace-1'
  };

  const result = await detector.detect(context);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.confidence, 1.0);
  assert.match(result.reason, /login or registration page/i);
});

test('AmazonAuthenticationDetector - detect login input fields', async () => {
  const inspector = new MockPageInspector(
    'https://www.amazon.com.br/',
    [],
    ['#ap_email']
  );
  const detector = new AmazonAuthenticationDetector();
  const context: AuthenticationDetectionContext = {
    marketplace: 'amazon',
    pageInspector: inspector,
    startedAt: new Date().toISOString(),
    sessionId: 'session-1',
    profileId: 'profile-1',
    requestId: 'req-1',
    traceId: 'trace-1'
  };

  const result = await detector.detect(context);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.confidence, 0.95);
  assert.match(result.reason, /login form input fields/i);
});

test('AmazonAuthenticationDetector - detect complete credentials cookies only', async () => {
  const inspector = new MockPageInspector(
    'https://www.amazon.com.br/gp/css/homepage.html',
    [
      { name: 'x-main', value: '1', domain: 'amazon.com.br', path: '/', expires: 0, httpOnly: false, secure: true, sameSite: 'Lax' },
      { name: 'at-main', value: '2', domain: 'amazon.com.br', path: '/', expires: 0, httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: 'session-token', value: '3', domain: 'amazon.com.br', path: '/', expires: 0, httpOnly: true, secure: true, sameSite: 'Lax' }
    ]
  );
  const detector = new AmazonAuthenticationDetector();
  const context: AuthenticationDetectionContext = {
    marketplace: 'amazon',
    pageInspector: inspector,
    startedAt: new Date().toISOString(),
    sessionId: 'session-1',
    profileId: 'profile-1',
    requestId: 'req-1',
    traceId: 'trace-1'
  };

  const result = await detector.detect(context);
  assert.strictEqual(result.authenticated, true);
  assert.strictEqual(result.confidence, 0.95);
  assert.match(result.reason, /Required authentication cookies/i);
});

test('AmazonAuthenticationDetector - detect complete cookies and authenticated account menu text', async () => {
  const inspector = new MockPageInspector(
    'https://www.amazon.com.br/',
    [
      { name: 'x-main', value: '1', domain: 'amazon.com.br', path: '/', expires: 0, httpOnly: false, secure: true, sameSite: 'Lax' },
      { name: 'at-main', value: '2', domain: 'amazon.com.br', path: '/', expires: 0, httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: 'session-token', value: '3', domain: 'amazon.com.br', path: '/', expires: 0, httpOnly: true, secure: true, sameSite: 'Lax' }
    ],
    ['#nav-link-accountList-nav-line-1'],
    { '#nav-link-accountList-nav-line-1': 'Olá, Emerson' }
  );
  const detector = new AmazonAuthenticationDetector();
  const context: AuthenticationDetectionContext = {
    marketplace: 'amazon',
    pageInspector: inspector,
    startedAt: new Date().toISOString(),
    sessionId: 'session-1',
    profileId: 'profile-1',
    requestId: 'req-1',
    traceId: 'trace-1'
  };

  const result = await detector.detect(context);
  assert.strictEqual(result.authenticated, true);
  assert.strictEqual(result.confidence, 1.0);
  assert.match(result.reason, /Required authentication cookies and authenticated user menu/i);
});

test('AmazonAuthenticationDetector - detect partial credentials cookies', async () => {
  const inspector = new MockPageInspector(
    'https://www.amazon.com.br/',
    [
      { name: 'x-main', value: '1', domain: 'amazon.com.br', path: '/', expires: 0, httpOnly: false, secure: true, sameSite: 'Lax' }
    ]
  );
  const detector = new AmazonAuthenticationDetector();
  const context: AuthenticationDetectionContext = {
    marketplace: 'amazon',
    pageInspector: inspector,
    startedAt: new Date().toISOString(),
    sessionId: 'session-1',
    profileId: 'profile-1',
    requestId: 'req-1',
    traceId: 'trace-1'
  };

  const result = await detector.detect(context);
  assert.strictEqual(result.authenticated, false);
  assert.strictEqual(result.confidence, 0.30);
  assert.match(result.reason, /Partial authentication cookies/i);
});
