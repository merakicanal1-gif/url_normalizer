import { chromium, Browser } from 'playwright-core';
import { IBrowserRuntime } from '../../../domain/ports/IBrowserRuntime.js';
import * as crypto from 'node:crypto';

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e: any) {
    return e.code === 'EPERM';
  }
}

export class PlaywrightBrowserRuntime implements IBrowserRuntime {
  public readonly runtimeId = crypto.randomUUID();
  private workerBrowser: Browser | null = null;
  private interactiveBrowser: Browser | null = null;

  constructor(
    private logger: { info: (msg: string) => void; warn?: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {
    this.logger.info(`[Runtime] created runtimeId=${this.runtimeId}`);
  }

  public async start(): Promise<void> {
    this.logger.info('[PlaywrightBrowserRuntime] Inicializando runtimes de navegadores locais...');
    
    // Iniciar Interactive Browser (headful com fallback para headless se sem X11)
    try {
      this.interactiveBrowser = await chromium.launch({
        headless: false
      });
      this.logger.info('[PlaywrightBrowserRuntime] Interactive Browser (headful) iniciado com sucesso.');
    } catch (err: any) {
      const isMissingX = err.message.includes('Missing X server') || 
                          err.message.includes('DISPLAY') || 
                          err.message.includes('headed browser without having a XServer');
      
      if (isMissingX) {
        const warnMsg = '[PlaywrightBrowserRuntime] Servidor X11 ausente. Iniciando Interactive Browser em modo headless como fallback.';
        if (this.logger.warn) {
          this.logger.warn(warnMsg);
        } else {
          this.logger.info(warnMsg);
        }
        this.interactiveBrowser = await chromium.launch({
          headless: true
        });
        this.logger.info('[PlaywrightBrowserRuntime] Interactive Browser (headless) iniciado com sucesso como fallback.');
      } else {
        this.logger.error('[PlaywrightBrowserRuntime] Falha ao iniciar Interactive Browser (headful)', err);
        throw err;
      }
    }

    const interactivePid = (this.interactiveBrowser as any).process?.()?.pid;
    this.logger.info(`[PlaywrightBrowserRuntime] [start] runtimeId=${this.runtimeId} Interactive Browser criado. PID: ${interactivePid}, Versão: ${this.interactiveBrowser.version()}, Conectado: ${this.interactiveBrowser.isConnected()}`);
    
    this.interactiveBrowser.on('disconnected', () => {
      const pidActive = interactivePid ? isPidAlive(interactivePid) : false;
      const warnMsg = `[PlaywrightBrowserRuntime] [EVENT disconnected] runtimeId=${this.runtimeId} Interactive Browser desconectou. Timestamp: ${new Date().toISOString()}, PID: ${interactivePid}, PID Ativo: ${pidActive}, Stack: ${new Error().stack}`;
      if (this.logger.warn) {
        this.logger.warn(warnMsg);
      } else {
        this.logger.info(warnMsg);
      }
    });

    // Iniciar Worker Browser (headless)
    try {
      this.workerBrowser = await chromium.launch({
        headless: true
      });
      this.logger.info('[PlaywrightBrowserRuntime] Worker Browser (headless) iniciado com sucesso.');
    } catch (err: any) {
      this.logger.error('[PlaywrightBrowserRuntime] Falha ao iniciar Worker Browser (headless)', err);
      throw err;
    }

    const workerPid = (this.workerBrowser as any).process?.()?.pid;
    this.logger.info(`[PlaywrightBrowserRuntime] [start] runtimeId=${this.runtimeId} Worker Browser criado. PID: ${workerPid}, Versão: ${this.workerBrowser.version()}, Conectado: ${this.workerBrowser.isConnected()}`);
    
    this.workerBrowser.on('disconnected', () => {
      const pidActive = workerPid ? isPidAlive(workerPid) : false;
      const warnMsg = `[PlaywrightBrowserRuntime] [EVENT disconnected] runtimeId=${this.runtimeId} Worker Browser desconectou. Timestamp: ${new Date().toISOString()}, PID: ${workerPid}, PID Ativo: ${pidActive}, Stack: ${new Error().stack}`;
      if (this.logger.warn) {
        this.logger.warn(warnMsg);
      } else {
        this.logger.info(warnMsg);
      }
    });

    // LOG TEMPORÁRIO
    this.logger.info(`[PlaywrightBrowserRuntime] [start] runtimeId=${this.runtimeId} workerBrowser criado: ${this.workerBrowser !== null}, interactiveBrowser criado: ${this.interactiveBrowser !== null}`);
  }

  public async shutdown(): Promise<void> {
    // LOG TEMPORÁRIO
    this.logger.info(`[PlaywrightBrowserRuntime] [shutdown] runtimeId=${this.runtimeId} shutdown() chamado. Stack: ${new Error().stack}`);
    this.logger.info('[PlaywrightBrowserRuntime] Encerrando runtimes de navegadores...');
    if (this.interactiveBrowser) {
      await this.interactiveBrowser.close().catch(() => {});
      this.interactiveBrowser = null;
    }
    if (this.workerBrowser) {
      await this.workerBrowser.close().catch(() => {});
      this.workerBrowser = null;
    }
    this.logger.info('[PlaywrightBrowserRuntime] Runtimes encerrados.');
  }

  public getWorkerBrowser(): Browser {
    // LOG TEMPORÁRIO
    this.logger.info(`[PlaywrightBrowserRuntime] [getWorkerBrowser] runtimeId=${this.runtimeId} workerBrowser === null: ${this.workerBrowser === null}, isConnected: ${this.workerBrowser ? this.workerBrowser.isConnected() : 'N/A'}`);
    if (!this.workerBrowser) {
      throw new Error('Worker Browser não foi inicializado ou já foi encerrado.');
    }
    return this.workerBrowser;
  }

  public getInteractiveBrowser(): Browser {
    // LOG TEMPORÁRIO
    this.logger.info(`[PlaywrightBrowserRuntime] [getInteractiveBrowser] runtimeId=${this.runtimeId} interactiveBrowser === null: ${this.interactiveBrowser === null}, isConnected: ${this.interactiveBrowser ? this.interactiveBrowser.isConnected() : 'N/A'}`);
    if (!this.interactiveBrowser) {
      throw new Error('Interactive Browser não foi inicializado ou já foi encerrado.');
    }
    return this.interactiveBrowser;
  }

  public async healthCheck(): Promise<{ workerAlive: boolean; interactiveAlive: boolean }> {
    // LOG TEMPORÁRIO
    this.logger.info(`[PlaywrightBrowserRuntime] [healthCheck] runtimeId=${this.runtimeId} workerBrowser === null: ${this.workerBrowser === null}, interactiveBrowser === null: ${this.interactiveBrowser === null}, workerBrowser.isConnected(): ${this.workerBrowser ? this.workerBrowser.isConnected() : 'N/A'}, interactiveBrowser.isConnected(): ${this.interactiveBrowser ? this.interactiveBrowser.isConnected() : 'N/A'}`);
    return {
      workerAlive: this.workerBrowser ? this.workerBrowser.isConnected() : false,
      interactiveAlive: this.interactiveBrowser ? this.interactiveBrowser.isConnected() : false
    };
  }
}
