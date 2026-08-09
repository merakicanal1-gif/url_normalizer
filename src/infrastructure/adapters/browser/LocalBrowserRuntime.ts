import { chromium, Browser, BrowserContext, Page } from 'playwright-core';
import { IBrowserRuntime } from '../../../domain/ports/IBrowserRuntime.js';
import { BrowserConfig } from './BrowserConfig.js';
import { IApplicationEventBus } from '../../../domain/ports/IApplicationEventBus.js';
import { BrowserNotRunningError } from '../../../domain/errors/BrowserNotRunningError.js';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export class LocalBrowserRuntime implements IBrowserRuntime {
  private context: BrowserContext | null = null; // Representa o contexto padrão ('default')
  private browser: Browser | null = null;         // Utilizado apenas no modo CDP
  private contexts = new Map<string, BrowserContext>();
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

    if (this.config.browserMode === 'cdp') {
      if (!this.context || !this.isRunning || !this.browser || !this.browser.isConnected()) {
        needsRecovery = true;
      }
    } else {
      // Modo persistent: garantir que default, amazon e mercadolivre estejam ativos
      if (!this.isRunning || !this.context) {
        needsRecovery = true;
      } else {
        try {
          // Tenta ler abas do contexto padrão
          this.context.pages();

          // Verificar os perfis específicos
          const amazonCtx = this.contexts.get('amazon');
          if (amazonCtx) {
            amazonCtx.pages();
          } else {
            needsRecovery = true;
          }

          const mlCtx = this.contexts.get('mercadolivre');
          if (mlCtx) {
            mlCtx.pages();
          } else {
            needsRecovery = true;
          }
        } catch (err) {
          needsRecovery = true;
        }
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
        this.logger.warn?.('[LocalBrowserRuntime] Detetada desconexão ou fechamento de contextos persistentes. Iniciando recuperação automática...');
        await this.cleanInternalState();
        await this.start();
        this.recovered = true;
        this.logger.info('[LocalBrowserRuntime] Runtime persistente recuperado e reiniciado com sucesso.');
      }
    }
  }

  private async cleanInternalState(): Promise<void> {
    const isCdp = this.config.browserMode === 'cdp';
    for (const [key, ctx] of this.contexts.entries()) {
      try {
        if (isCdp) {
          const pagesToClose = [...this.managedPages].filter(p => {
            try {
              return p.context() === ctx;
            } catch (e) {
              return false;
            }
          });
          for (const page of pagesToClose) {
            await page.close().catch(() => {});
          }
        } else {
          const pages = ctx.pages();
          for (const page of pages) {
            await page.close().catch(() => {});
          }
          await ctx.close().catch(() => {});
        }
      } catch (e) {
        // Ignorar falhas ao tentar fechar páginas/contextos já limpos
      }
    }
    this.contexts.clear();
    this.context = null;
    this.browser = null;
    this.managedPages.clear();
    if (!isCdp) {
      this.manualPages.clear();
    }
    this.isRunning = false;
  }

  private async getOrCreateContext(key: string): Promise<BrowserContext> {
    let ctx = this.contexts.get(key);
    if (!ctx) {
      const isCdp = this.config.browserMode === 'cdp';
      if (isCdp) {
        if (!this.browser) {
          throw new Error('Navegador CDP não conectado.');
        }
        // Utilizar o contexto principal do Chrome que já está aberto e logado
        const existingContext = this.browser.contexts()[0];
        ctx = existingContext || await this.browser.newContext();
        this.contexts.set(key, ctx);
      } else {
        const dir = path.join(this.config.userDataDir, key);
        this.logger.info(`[LocalBrowserRuntime] Inicializando persistent context para ${key} em ${dir}`);
        ctx = await chromium.launchPersistentContext(dir, {
          headless: this.config.headless,
          executablePath: this.config.executablePath,
          args: this.config.args,
          viewport: this.config.viewport,
          locale: this.config.locale,
          timezoneId: this.config.timezone,
          userAgent: this.config.userAgent,
          acceptDownloads: this.config.downloads,
          slowMo: this.config.slowMo
        });

        await ctx.addInitScript('Object.defineProperty(navigator, "webdriver", { get: () => undefined });');
        
        ctx.on('close', () => {
          this.logger.warn?.(`[LocalBrowserRuntime] O BrowserContext para ${key} foi fechado.`);
          this.contexts.delete(key);
          if (key === 'default') {
            this.context = null;
            this.isRunning = false;
          }
        });

        // Configurar auto-recuperação proativa no caso de desconexão inesperada
        ctx.browser()?.on('disconnected', () => {
          this.logger.warn?.(`[LocalBrowserRuntime] O navegador Chromium associado ao contexto ${key} foi desconectado.`);
          this.contexts.delete(key);
          if (key === 'default') {
            this.context = null;
            this.isRunning = false;
          }
          
          // Auto-recuperação debouncada para evitar loops de consumo de CPU
          setTimeout(() => {
            if (!this.isRunning) {
              this.logger.info('[LocalBrowserRuntime] Iniciando recuperação automática proativa por desconexão...');
              this.ensureStarted().catch(err => {
                this.logger.error('[LocalBrowserRuntime] Falha na recuperação automática proativa', err);
              });
            }
          }, 1000);
        });

        this.contexts.set(key, ctx);

        if (key === 'default') {
          this.context = ctx;
        }

        // Publicar evento de contexto criado no eventBus
        this.eventBus.publish({
          eventId: crypto.randomUUID(),
          event: 'BROWSER_CONTEXT_CREATED',
          version: 1,
          occurredAt: new Date().toISOString(),
          source: 'LocalBrowserRuntime',
          traceId: null,
          requestId: null,
          sessionId: null,
          marketplace: key === 'default' ? null : key,
          profileId: key === 'default' ? 'default' : key,
          payload: { 
            type: this.config.headless ? 'headless' : 'headful',
            contextId: `persistent-context-${key}`
          }
        });
      }
    }
    return ctx;
  }

  public isAlive(): boolean {
    if (!this.isRunning) return false;
    const isCdp = this.config.browserMode === 'cdp';
    if (isCdp) {
      return this.browser ? this.browser.isConnected() : false;
    } else {
      return this.getIsContextAlive();
    }
  }

  public getIsContextAliveFor(key: string): boolean {
    const ctx = this.contexts.get(key);
    if (!ctx) return false;
    try {
      ctx.pages();
      return true;
    } catch (e) {
      return false;
    }
  }

  public getIsContextAlive(): boolean {
    if (this.config.browserMode === 'cdp') {
      if (!this.context) return false;
      try {
        this.context.pages();
        const browser = this.context.browser();
        return browser ? browser.isConnected() : false;
      } catch (e) {
        return false;
      }
    } else {
      // Modo persistente: todos os contextos básicos de produção (default, amazon, mercadolivre) devem estar funcionais
      if (!this.context) return false;
      try {
        this.context.pages();

        const amazonCtx = this.contexts.get('amazon');
        if (amazonCtx) amazonCtx.pages();
        else return false;

        const mlCtx = this.contexts.get('mercadolivre');
        if (mlCtx) mlCtx.pages();
        else return false;

        return true;
      } catch (e) {
        return false;
      }
    }
  }

  public async connect(): Promise<void> {
    const isCdp = this.config.browserMode === 'cdp';
    if (!isCdp) {
      throw new Error('O método connect() só é suportado no modo BROWSER_MODE=cdp.');
    }
    this.logger.info(`[LocalBrowserRuntime] Conectando via CDP ao endpoint: ${this.config.cdpEndpoint}...`);
    try {
      await this.cleanInternalState();

      let connected = false;
      const maxRetries = 15;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          this.browser = await chromium.connectOverCDP(this.config.cdpEndpoint);
          connected = true;
          break;
        } catch (err: any) {
          if (attempt === maxRetries) {
            this.logger.error('[LocalBrowserRuntime] Falha ao conectar via CDP após todas as tentativas', err);
            throw new BrowserNotRunningError();
          }
          this.logger.info(`[LocalBrowserRuntime] Aguardando o Google Chrome na porta 9222 (tentativa ${attempt}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      if (!this.browser) {
        throw new BrowserNotRunningError();
      }
      const contexts = this.browser.contexts();
      if (contexts.length === 0) {
        throw new Error("Nenhum BrowserContext disponível.");
      }
      if (contexts.length > 1) {
        this.logger.warn?.(`[LocalBrowserRuntime] Múltiplos contextos de navegador detectados (${contexts.length}). Utilizando o primeiro.`);
      }
      this.context = contexts[0];
      this.contexts.set('default', contexts[0]);
      this.contexts.set('amazon', contexts[0]);
      this.contexts.set('mercadolivre', contexts[0]);

      this.startTime = Date.now();
      this.lastReconnectTime = new Date().toISOString();
      this.isRunning = true;

      this.browser.on('disconnected', () => {
        this.logger.warn?.('[LocalBrowserRuntime] O Chromium browser via CDP foi desconectado.');
        this.isRunning = false;
        
        this.eventBus.publish({
          eventId: crypto.randomUUID(),
          event: 'BROWSER_STOPPED',
          version: 1,
          occurredAt: new Date().toISOString(),
          source: 'LocalBrowserRuntime',
          traceId: null,
          requestId: null,
          sessionId: null,
          marketplace: null,
          profileId: null,
          payload: { type: this.config.headless ? 'headless' : 'headful' }
        });
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
    this.logger.info('[LocalBrowserRuntime] Desconexão concluída com sucesso.');
  }

  public async start(): Promise<void> {
    const isCdp = this.config.browserMode === 'cdp';
    if (isCdp) {
      await this.connect();
    } else {
      this.logger.info('[LocalBrowserRuntime] Inicializando runtime persistente...');
      try {
        await this.cleanInternalState();

        // Inicializar e carregar os contextos persistentes necessários em paralelo/sequência
        await this.getOrCreateContext('default');
        await this.getOrCreateContext('amazon');
        await this.getOrCreateContext('mercadolivre');

        this.startTime = Date.now();
        this.isRunning = true;
        this.logger.info('[LocalBrowserRuntime] Runtime persistente inicializado com sucesso.');
      } catch (err: any) {
        this.logger.error('[LocalBrowserRuntime] Falha fatal ao inicializar o runtime persistente', err);
        throw err;
      }
    }
  }

  public async shutdown(): Promise<void> {
    this.logger.info('[LocalBrowserRuntime] Encerrando runtime do navegador...');
    await this.cleanInternalState();

    this.eventBus.publish({
      eventId: crypto.randomUUID(),
      event: 'BROWSER_CONTEXT_CLOSED',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'LocalBrowserRuntime',
      traceId: null,
      requestId: null,
      sessionId: null,
      marketplace: null,
      profileId: null,
      payload: { contextId: 'persistent-context-all' }
    });

    this.eventBus.publish({
      eventId: crypto.randomUUID(),
      event: 'BROWSER_STOPPED',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'LocalBrowserRuntime',
      traceId: null,
      requestId: null,
      sessionId: null,
      marketplace: null,
      profileId: null,
      payload: { type: this.config.headless ? 'headless' : 'headful' }
    });

    this.logger.info('[LocalBrowserRuntime] Runtime do navegador encerrado com sucesso.');
  }

  public async getPersistentContext(): Promise<BrowserContext> {
    await this.ensureStarted();
    if (!this.context) {
      throw new Error('Navegador persistente não foi inicializado. Chame start() primeiro.');
    }
    return this.context;
  }

  public async getContext(marketplace?: string): Promise<BrowserContext> {
    await this.ensureStarted();
    const key = marketplace ? marketplace.toLowerCase() : 'default';
    return this.getOrCreateContext(key);
  }

  public async newPage(isManaged: boolean = true, marketplace?: string): Promise<Page> {
    await this.ensureStarted();
    const context = await this.getContext(marketplace);

    const totalPages = this.managedPages.size + this.manualPages.size;
    if (totalPages >= 3) {
      this.logger.info(`[LocalBrowserRuntime] Limpando ${this.managedPages.size} abas gerenciadas antigas...`);
      for (const p of this.managedPages) {
        if (!p.isClosed()) {
          await p.close().catch(() => {});
        }
      }
      this.managedPages.clear();
    }

    const page = await context.newPage();

    if (isManaged) {
      this.managedPages.add(page);
    } else {
      this.manualPages.add(page);
    }

    const key = marketplace ? marketplace.toLowerCase() : 'default';
    page.on('close', () => {
      this.managedPages.delete(page);
      this.manualPages.delete(page);
    });

    return page;
  }

  public async closePage(page: Page): Promise<void> {
    if (page && !page.isClosed()) {
      await page.close({ runBeforeUnload: false }).catch((err) => {
        this.logger.warn?.(`[LocalBrowserRuntime] Erro ao fechar página: ${err.message}`);
      });
    }
  }

  public async restart(): Promise<void> {
    this.logger.info('[LocalBrowserRuntime] Reiniciando runtime do navegador...');
    await this.shutdown();
    await this.start();
    this.lastRestartTime = new Date().toISOString();
  }

  public async closeAllPages(): Promise<void> {
    const isCdp = this.config.browserMode === 'cdp';
    for (const [key, ctx] of this.contexts.entries()) {
      try {
        if (isCdp) {
          const pagesToClose = [...this.managedPages].filter(p => {
            try {
              return p.context() === ctx;
            } catch (e) {
              return false;
            }
          });
          for (const page of pagesToClose) {
            if (!page.isClosed()) {
              await page.close().catch(() => {});
            }
          }
        } else {
          const openPages = ctx.pages();
          for (const page of openPages) {
            await page.close().catch(() => {});
          }
        }
      } catch (e) {
        this.logger.error(`[LocalBrowserRuntime] Falha ao fechar todas as abas para o contexto ${key}`, e);
      }
    }
    this.managedPages.clear();
    if (!isCdp) {
      this.manualPages.clear();
    }
  }

  // Getters para telemetria / BrowserHealthService
  public getStartTime(): number {
    return this.startTime;
  }

  public getLastRestartTime(): string | null {
    return this.lastRestartTime;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
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
    return this.contexts.size;
  }

  public getPagesCount(): number {
    let total = 0;
    for (const ctx of this.contexts.values()) {
      try {
        total += ctx.pages().length;
      } catch (e) {}
    }
    return total;
  }

  public getLastReconnectTime(): string | null {
    return this.lastReconnectTime;
  }
}
