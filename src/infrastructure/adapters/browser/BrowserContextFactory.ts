import { Browser, BrowserContext } from 'playwright-core';
import { BrowserProfile } from '../../../domain/models/BrowserProfile.js';

export class BrowserContextFactory {
  public static async createAnonymousContext(browser: Browser, profile?: BrowserProfile): Promise<BrowserContext> {
    console.log('[BrowserContextFactory] [browser.newContext] Criando contexto anônimo.');
    return browser.newContext({
      locale: profile?.locale || 'pt-BR',
      timezoneId: profile?.timezoneId || 'America/Sao_Paulo',
      colorScheme: profile?.colorScheme || 'light',
      viewport: profile?.viewport !== undefined ? profile.viewport : { width: 1366, height: 768 },
      userAgent: profile?.userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      extraHTTPHeaders: profile?.extraHTTPHeaders,
      javaScriptEnabled: profile?.javaScriptEnabled !== undefined ? profile.javaScriptEnabled : true
    });
  }

  public static async createAuthenticatedContext(browser: Browser, storageState: any, profile?: BrowserProfile): Promise<BrowserContext> {
    console.log('[BrowserContextFactory] [browser.newContext] Criando contexto autenticado.');
    return browser.newContext({
      storageState,
      locale: profile?.locale || 'pt-BR',
      timezoneId: profile?.timezoneId || 'America/Sao_Paulo',
      colorScheme: profile?.colorScheme || 'light',
      viewport: profile?.viewport !== undefined ? profile.viewport : { width: 1366, height: 768 },
      userAgent: profile?.userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      extraHTTPHeaders: profile?.extraHTTPHeaders,
      javaScriptEnabled: profile?.javaScriptEnabled !== undefined ? profile.javaScriptEnabled : true
    });
  }

  public static async createInteractiveContext(browser: Browser, profile?: BrowserProfile): Promise<BrowserContext> {
    console.log('[BrowserContextFactory] [browser.newContext] Criando contexto interativo.');
    return browser.newContext({
      locale: profile?.locale || 'pt-BR',
      timezoneId: profile?.timezoneId || 'America/Sao_Paulo',
      colorScheme: profile?.colorScheme || 'light',
      viewport: profile?.viewport !== undefined ? profile.viewport : { width: 1366, height: 768 },
      userAgent: profile?.userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      extraHTTPHeaders: profile?.extraHTTPHeaders,
      javaScriptEnabled: profile?.javaScriptEnabled !== undefined ? profile.javaScriptEnabled : true,
      acceptDownloads: true
    });
  }

  public static async disposeContext(context: BrowserContext): Promise<void> {
    if (context) {
      console.log('[BrowserContextFactory] [context.close] Fechando contexto.');
      await context.close().catch(() => {});
    }
  }
}
