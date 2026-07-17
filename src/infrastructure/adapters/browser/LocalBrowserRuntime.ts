import { chromium, Browser, BrowserContext, Page } from 'playwright-core';
import { IBrowserRuntime } from '../../../domain/ports/IBrowserRuntime.js';
import { BrowserConfig } from './BrowserConfig.js';
import { IApplicationEventBus } from '../../../domain/ports/IApplicationEventBus.js';
import { BrowserNotRunningError } from '../../../domain/errors/BrowserNotRunningError.js';
import * as crypto from 'node:crypto';

export class LocalBrowserRuntime implements IBrowserRuntime {
  private context: BrowserContext | null = null;
  private browser: Browser | null = null;
  private managedPages = new Set<Page>();
  private manualPages = new Set<Page>();
  private startTime: number = 0;
  private lastRestartTime: string | null = null;
  private lastReconnectTime: string | null = null;
  private isRunning: boolean = false;
  private recovered: boolean = false;

  constructor(
    private readonly config: BrowserConfig,
    private readonly eventBus: IApplicationEventBus,
    private readonly logger: { 
      info: (msg: string) => void; 
      error: (msg: string, err?: any) => void;
      warn?: (msg: string) => void;
    }
  ) {}

  private async ensureStarted(): Promise<void> {
    let needsRecovery = false;

    if (!this.context || !this.isRunning) {
      needsRecovery = true;
    } else {
      try {
        // Testar se o contexto de fato está acessível
        this.context.pages();
        const browser = this.context.browser();
        if (!browser || !browser.isConnected()) {
          needsRecovery = true;
        }
      } catch (err) {
        needsRecovery = true;
      }
    }

    if (needsRecovery) {
      const isCdp = this.config.browserMode === 'cdp';
      if (isCdp) {
        this.logger.warn?.('[LocalBrowserRuntime] Detetada desconexão com o Chrome via CDP. Iniciando reconexão automática...');
        await this.cleanInternalState();
        await this.connect();
        this.recovered = true;
        this.logger.info('[LocalBrowserRuntime] Conexão CDP restabelecida com sucesso.');
      } else {
        this.logger.warn?.('[LocalBrowserRuntime] Detetada desconexão ou fechamento do navegador. Iniciando recuperação automática...');
        await this.cleanInternalState();
        await this.start();
        this.recovered = true;
        this.logger.info('[LocalBrowserRuntime] Navegador recuperado e reiniciado com sucesso.');
      }
    }
  }

  private async cleanInternalState(): Promise<void> {
    const isCdp = this.config.browserMode === 'cdp';
    if (this.context) {
      try {
        if (isCdp) {
          // Close only managed pages (API-owned pages)
          const pagesToClose = [...this.managedPages];
          for (const page of pagesToClose) {
            await page.close().catch(() => {});
          }
        } else {
          // In persistent mode, close all pages and context
          const pages = this.context.pages();
          for (const page of pages) {
            await page.close().catch(() => {});
          }
          await this.context.close().catch(() => {});
        }
      } catch (e) {
        // Ignorar erros caso já esteja fechado
      }
      this.context = null;
    }
    this.browser = null;
    this.managedPages.clear();
    if (!isCdp) {
      this.manualPages.clear();
    }
    this.isRunning = false;
  }

  public async connect(): Promise<void> {
    const isCdp = this.config.browserMode === 'cdp';
    if (!isCdp) {
      throw new Error('O método connect() só é suportado no modo BROWSER_MODE=cdp.');
    }
    this.logger.info(`[LocalBrowserRuntime] Conectando via CDP ao endpoint: ${this.config.cdpEndpoint}...`);
    try {
      await this.cleanInternalState();

      this.browser = await chromium.connectOverCDP(this.config.cdpEndpoint);
      const contexts = this.browser.contexts();
      if (contexts.length === 0) {
        throw new Error("Nenhum BrowserContext disponível.");
      }
      if (contexts.length > 1) {
        this.logger.warn?.(`[LocalBrowserRuntime] Múltiplos contextos de navegador detectados (${contexts.length}). Utilizando o primeiro.`);
      }
      this.context = contexts[0];

      this.startTime = Date.now();
      this.lastReconnectTime = new Date().toISOString();
      this.isRunning = true;

      // Listeners
      this.browser.on('disconnected', () => {
        this.logger.warn?.('[LocalBrowserRuntime] O Chromium browser via CDP foi desconectado.');
        this.isRunning = false;
        this.eventBus.publish({
          eventId: crypto.randomUUID(),
          event: 'BrowserDisconnected',
          version: 1,
          occurredAt: new Date().toISOString(),
          source: 'LocalBrowserRuntime',
          payload: { reason: 'CDP browser disconnected' }
        });
      });

      this.eventBus.publish({
        eventId: crypto.randomUUID(),
        event: 'BrowserStarted',
        version: 1,
        occurredAt: new Date().toISOString(),
        source: 'LocalBrowserRuntime',
        payload: { 
          persistent: true,
          mode: 'cdp',
          endpoint: this.config.cdpEndpoint
        }
      });

      this.logger.info(`[LocalBrowserRuntime] Conectado via CDP com sucesso ao endpoint: ${this.config.cdpEndpoint}`);
    } catch (err: any) {
      this.logger.error('[LocalBrowserRuntime] Falha ao conectar via CDP', err);
      throw new BrowserNotRunningError();
    }
  }

  public async disconnect(): Promise<void> {
    const isCdp = this.config.browserMode === 'cdp';
    if (!isCdp) {
      throw new Error('O método disconnect() só é suportado no modo BROWSER_MODE=cdp.');
    }
    this.logger.info('[LocalBrowserRuntime] Desconectando da sessão CDP...');

    if (this.context) {
      this.context.removeAllListeners('close');
    }
    if (this.browser) {
      this.browser.removeAllListeners('disconnected');
    }

    this.context = null;
    this.browser = null;
    this.isRunning = false;

    this.eventBus.publish({
      eventId: crypto.randomUUID(),
      event: 'BrowserDisconnected',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'LocalBrowserRuntime',
      payload: { reason: 'Manual disconnect request' }
    });

    this.logger.info('[LocalBrowserRuntime] Desconexão concluída com sucesso.');
  }

  public async start(): Promise<void> {
    const isCdp = this.config.browserMode === 'cdp';
    if (isCdp) {
      await this.connect();
    } else {
      this.logger.info('[LocalBrowserRuntime] Inicializando navegador persistente...');

      try {
        this.context = await chromium.launchPersistentContext(this.config.userDataDir, {
          headless: this.config.headless,
          args: this.config.args,
          viewport: this.config.viewport,
          locale: this.config.locale,
          timezoneId: this.config.timezone,
          userAgent: this.config.userAgent,
          acceptDownloads: this.config.downloads,
          slowMo: this.config.slowMo
        });

        // Evasão contra detecções do navigator.webdriver no nível Chromium
        await this.context.addInitScript('Object.defineProperty(navigator, "webdriver", { get: () => undefined });');

        this.startTime = Date.now();
        this.isRunning = true;

        // Registrar eventos para capturar fechamento assíncrono
        this.context.on('close', () => {
          this.logger.warn?.('[LocalBrowserRuntime] O BrowserContext foi fechado de forma assíncrona.');
          this.isRunning = false;
        });

        this.context.browser()?.on('disconnected', () => {
          this.logger.warn?.('[LocalBrowserRuntime] O Chromium browser foi desconectado.');
          this.isRunning = false;
          this.eventBus.publish({
            eventId: crypto.randomUUID(),
            event: 'BrowserDisconnected',
            version: 1,
            occurredAt: new Date().toISOString(),
            source: 'LocalBrowserRuntime',
            payload: { reason: 'Chromium process disconnected' }
          });
        });

        this.eventBus.publish({
          eventId: crypto.randomUUID(),
          event: 'BrowserStarted',
          version: 1,
          occurredAt: new Date().toISOString(),
          source: 'LocalBrowserRuntime',
          payload: { 
            persistent: true,
            userDataDir: this.config.userDataDir,
            headless: this.config.headless
          }
        });

        this.logger.info(`[LocalBrowserRuntime] Navegador persistente iniciado com sucesso no diretório: ${this.config.userDataDir}`);
      } catch (err: any) {
        this.logger.error('[LocalBrowserRuntime] Falha fatal ao inicializar o navegador persistente', err);
        throw err;
      }
    }
  }

  public async shutdown(): Promise<void> {
    const isCdp = this.config.browserMode === 'cdp';
    if (isCdp) {
      this.logger.info('[LocalBrowserRuntime] Encerrando runtime (CDP)...');
      const pagesToClose = [...this.managedPages];
      for (const page of pagesToClose) {
        await page.close().catch(() => {});
      }
      this.managedPages.clear();
      await this.disconnect();
    } else {
      this.logger.info('[LocalBrowserRuntime] Encerrando navegador persistente...');
      await this.cleanInternalState();

      this.eventBus.publish({
        eventId: crypto.randomUUID(),
        event: 'BrowserDisconnected',
        version: 1,
        occurredAt: new Date().toISOString(),
        source: 'LocalBrowserRuntime',
        payload: { reason: 'Clean shutdown call' }
      });

      this.logger.info('[LocalBrowserRuntime] Navegador persistente encerrado com sucesso.');
    }
  }

  public async getPersistentContext(): Promise<BrowserContext> {
    await this.ensureStarted();
    if (!this.context) {
      throw new Error('Navegador persistente não foi inicializado. Chame start() primeiro.');
    }
    return this.context;
  }

  public async newPage(isManaged: boolean = true): Promise<Page> {
    await this.ensureStarted();
    const context = await this.getPersistentContext();

    // Warn de possível vazamento se houver muitas páginas abertas
    const totalPages = this.managedPages.size + this.manualPages.size;
    if (totalPages >= 5) {
      const warnMsg = `[LocalBrowserRuntime] ALERTA: Alto volume de abas abertas detectado (${totalPages} abas: ${this.managedPages.size} gerenciadas, ${this.manualPages.size} manuais). Possível vazamento de abas.`;
      this.logger.warn?.(warnMsg);
    }

    const page = await context.newPage();

    if (isManaged) {
      this.managedPages.add(page);
    } else {
      this.manualPages.add(page);
    }

    // Registrar o fechamento da página para limpar do gerenciamento
    page.on('close', () => {
      this.managedPages.delete(page);
      this.manualPages.delete(page);

      this.eventBus.publish({
        eventId: crypto.randomUUID(),
        event: 'PageClosed',
        version: 1,
        occurredAt: new Date().toISOString(),
        source: 'LocalBrowserRuntime',
        payload: { 
          isManaged,
          remainingManaged: this.managedPages.size,
          remainingManual: this.manualPages.size
        }
      });
    });

    this.eventBus.publish({
      eventId: crypto.randomUUID(),
      event: 'PageOpened',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'LocalBrowserRuntime',
      payload: { 
        isManaged,
        totalManaged: this.managedPages.size,
        totalManual: this.manualPages.size
      }
    });

    return page;
  }

  public async closePage(page: Page): Promise<void> {
    if (page && !page.isClosed()) {
      await page.close().catch((err) => {
        this.logger.error('[LocalBrowserRuntime] Falha ao fechar aba do navegador', err);
      });
    }
  }

  public async restart(): Promise<void> {
    const isCdp = this.config.browserMode === 'cdp';
    if (isCdp) {
      this.logger.info('[LocalBrowserRuntime] Solicitando reinicialização da conexão CDP...');
      await this.disconnect();
      await this.connect();
    } else {
      this.logger.info('[LocalBrowserRuntime] Solicitando reinicialização do navegador persistente...');
      await this.shutdown();
      await this.start();
    }
    this.lastRestartTime = new Date().toISOString();

    this.eventBus.publish({
      eventId: crypto.randomUUID(),
      event: 'BrowserRestarted',
      version: 1,
      occurredAt: this.lastRestartTime,
      source: 'LocalBrowserRuntime',
      payload: { timestamp: this.lastRestartTime }
    });
  }

  public async closeAllPages(): Promise<void> {
    const isCdp = this.config.browserMode === 'cdp';
    if (isCdp) {
      // Close only managed pages (API-owned pages), preserving manual operator pages
      const pagesToClose = [...this.managedPages];
      for (const page of pagesToClose) {
        if (!page.isClosed()) {
          await page.close().catch(() => {});
        }
      }
      this.managedPages.clear();
    } else {
      if (this.context) {
        try {
          const openPages = this.context.pages();
          for (const page of openPages) {
            await page.close().catch(() => {});
          }
        } catch (e) {
          this.logger.error('[LocalBrowserRuntime] Falha ao fechar todas as abas', e);
        }
      }
      this.managedPages.clear();
      this.manualPages.clear();
    }
  }

  // Getters para fins de telemetria / BrowserHealthService
  public getStartTime(): number {
    return this.startTime;
  }

  public getLastRestartTime(): string | null {
    return this.lastRestartTime;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getIsContextAlive(): boolean {
    if (!this.context) return false;
    try {
      this.context.pages();
      const browser = this.context.browser();
      return browser ? browser.isConnected() : false;
    } catch (e) {
      return false;
    }
  }

  public getRecovered(): boolean {
    return this.recovered;
  }

  public getManagedPagesCount(): number {
    return this.managedPages.size;
  }

  public getManualPagesCount(): number {
    return this.manualPages.size;
  }

  public getBrowserConfig(): BrowserConfig {
    return this.config;
  }

  public getConnectedViaCDP(): boolean {
    return this.config.browserMode === 'cdp' && this.getIsContextAlive();
  }

  public getCdpEndpoint(): string | null {
    return this.config.browserMode === 'cdp' ? this.config.cdpEndpoint : null;
  }

  public getBrowserName(): string {
    if (this.config.browserMode === 'cdp') {
      return 'Chrome';
    }
    return 'Chromium';
  }

  public getContextsCount(): number {
    if (this.context) {
      const browser = this.context.browser();
      if (browser) {
        return browser.contexts().length;
      }
      return 1;
    }
    return 0;
  }

  public getPagesCount(): number {
    if (this.context) {
      const browser = this.context.browser();
      if (browser) {
        let total = 0;
        for (const ctx of browser.contexts()) {
          try {
            total += ctx.pages().length;
          } catch (e) {}
        }
        return total;
      }
      try {
        return this.context.pages().length;
      } catch (e) {
        return 0;
      }
    }
    return 0;
  }

  public getLastReconnectTime(): string | null {
    return this.lastReconnectTime;
  }
}
