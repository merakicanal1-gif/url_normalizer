import { Page } from 'playwright-core';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';

export class PlaywrightNavigatorPage implements INavigatorPage {
  constructor(
    private page: Page
  ) {}

  public async goto(url: string, timeoutMs?: number): Promise<string> {
    try {
      await this.page.goto(url, {
        waitUntil: 'commit',
        timeout: timeoutMs || 10000
      });
    } catch (e: any) {
      console.log(`[PlaywrightNavigatorPage] Aviso no goto para ${url}: ${e.message}`);
      if (this.page.url() === 'about:blank') {
        throw e;
      }
    }
    return this.page.url();
  }

  public getFinalUrl(): string {
    const rawUrl = this.page.url();
    console.log(`[PlaywrightNavigatorPage] [getFinalUrl] page.url()="${rawUrl}", retornado="${rawUrl}"`);
    return rawUrl;
  }

  public async evaluate<T>(fn: string | ((...args: any[]) => T), arg?: any): Promise<T> {
    return this.page.evaluate(fn as any, arg);
  }

  public async close(): Promise<void> {
    console.log('[PlaywrightNavigatorPage] [page.close] Fechando página.');
    await this.page.close();
  }

  // Getter para permitir que adaptadores da infraestrutura acessem a API nativa
  public getRawPage(): Page {
    return this.page;
  }
}
