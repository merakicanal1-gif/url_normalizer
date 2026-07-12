import { Browser, BrowserContext } from 'playwright-core';
import { BrowserProfile } from '../../../domain/models/BrowserProfile.js';
import { IBrowserLaunchPolicy } from '../../../domain/ports/IBrowserLaunchPolicy.js';

export class BrowserContextFactory {
  constructor(private readonly launchPolicy: IBrowserLaunchPolicy) {}

  public async createAnonymousContext(browser: Browser, profile?: BrowserProfile): Promise<BrowserContext> {
    console.log('[BrowserContextFactory] [createAnonymousContext] Criando contexto anônimo.');
    const policy = this.launchPolicy.getLaunchOptions('worker', profile);
    
    const context = await browser.newContext({
      locale: policy.contextOptions.locale,
      timezoneId: policy.contextOptions.timezoneId,
      colorScheme: policy.contextOptions.colorScheme,
      viewport: policy.contextOptions.viewport || undefined,
      userAgent: policy.contextOptions.userAgent,
      extraHTTPHeaders: policy.contextOptions.extraHTTPHeaders,
      javaScriptEnabled: policy.contextOptions.javaScriptEnabled,
      permissions: policy.contextOptions.permissions,
      geolocation: policy.contextOptions.geolocation
    });

    for (const script of policy.initScripts) {
      await context.addInitScript(script.source);
    }

    return context;
  }

  public async createAuthenticatedContext(browser: Browser, storageState: any, profile?: BrowserProfile): Promise<BrowserContext> {
    console.log('[BrowserContextFactory] [createAuthenticatedContext] Criando contexto autenticado.');
    const policy = this.launchPolicy.getLaunchOptions('worker', profile);
    
    const context = await browser.newContext({
      storageState,
      locale: policy.contextOptions.locale,
      timezoneId: policy.contextOptions.timezoneId,
      colorScheme: policy.contextOptions.colorScheme,
      viewport: policy.contextOptions.viewport || undefined,
      userAgent: policy.contextOptions.userAgent,
      extraHTTPHeaders: policy.contextOptions.extraHTTPHeaders,
      javaScriptEnabled: policy.contextOptions.javaScriptEnabled,
      permissions: policy.contextOptions.permissions,
      geolocation: policy.contextOptions.geolocation
    });

    for (const script of policy.initScripts) {
      await context.addInitScript(script.source);
    }

    return context;
  }

  public async createInteractiveContext(browser: Browser, profile?: BrowserProfile): Promise<BrowserContext> {
    console.log('[BrowserContextFactory] [createInteractiveContext] Criando contexto interativo.');
    const policy = this.launchPolicy.getLaunchOptions('interactive', profile);
    
    const context = await browser.newContext({
      locale: policy.contextOptions.locale,
      timezoneId: policy.contextOptions.timezoneId,
      colorScheme: policy.contextOptions.colorScheme,
      viewport: policy.contextOptions.viewport || undefined,
      userAgent: policy.contextOptions.userAgent,
      extraHTTPHeaders: policy.contextOptions.extraHTTPHeaders,
      javaScriptEnabled: policy.contextOptions.javaScriptEnabled,
      permissions: policy.contextOptions.permissions,
      geolocation: policy.contextOptions.geolocation,
      acceptDownloads: policy.contextOptions.acceptDownloads
    });

    for (const script of policy.initScripts) {
      await context.addInitScript(script.source);
    }

    return context;
  }

  public async disposeContext(context: BrowserContext): Promise<void> {
    if (context) {
      console.log('[BrowserContextFactory] [disposeContext] Fechando contexto.');
      await context.close().catch(() => {});
    }
  }
}
