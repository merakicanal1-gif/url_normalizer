import { LocalBrowserRuntime } from '../../infrastructure/adapters/browser/LocalBrowserRuntime.js';

export class BrowserHealthService {
  constructor(private readonly browserRuntime: LocalBrowserRuntime) {}

  public getBrowserConfig() {
    return this.browserRuntime.getBrowserConfig();
  }

  public async getStatus(): Promise<{
    status: string;
    // Legados top-level
    running: boolean;
    healthy: boolean;
    browserConnected: boolean;
    contextAlive: boolean;
    persistent: boolean;
    browserVersion: string;
    managedPages: number;
    manualPages: number;
    browserData: string;
    headless: boolean;
    lastRestart: string | null;
    uptime: number;
    recovered?: boolean;
    mode: 'cdp' | 'persistent';
    endpoint: string | null;
    connected: boolean;
    ready: boolean;
    browserAlive: boolean;
    contexts: number;
    pages: number;
    browserName: string;
    lastReconnect: string | null;
    
    // Novo schema details solicitado
    details: {
      runtime: 'running' | 'stopped';
      browser: 'running' | 'stopped';
      mode: 'cdp' | 'persistent';
      headless: boolean;
      amazon_context: boolean;
      mercadolivre_context: boolean;
      managed_pages: number;
      manual_pages: number;
      ready: boolean;
    }
  }> {
    const isRunning = this.browserRuntime.getIsRunning();
    const contextAlive = this.browserRuntime.getIsContextAlive();
    const config = this.browserRuntime.getBrowserConfig();

    let amazonContextAlive = false;
    let mlContextAlive = false;

    if (config.browserMode === 'persistent') {
      amazonContextAlive = isRunning && this.browserRuntime.getIsContextAliveFor('amazon');
      mlContextAlive = isRunning && this.browserRuntime.getIsContextAliveFor('mercadolivre');
    } else {
      amazonContextAlive = isRunning && contextAlive;
      mlContextAlive = isRunning && contextAlive;
    }

    let browserVersion = 'unknown';
    let browserConnected = false;

    if (isRunning && contextAlive) {
      try {
        const context = await this.browserRuntime.getPersistentContext();
        const browser = context.browser();
        browserVersion = browser?.version() || 'unknown';
        browserConnected = config.browserMode === 'persistent' ? true : (browser?.isConnected() || false);
      } catch (err) {
        // Ignora erros
      }
    }

    const uptimeMs = isRunning ? Date.now() - this.browserRuntime.getStartTime() : 0;
    const healthy = config.browserMode === 'persistent'
      ? (isRunning && contextAlive && amazonContextAlive && mlContextAlive)
      : (isRunning && browserConnected && contextAlive);

    const ready = healthy;
    const status = ready ? 'ok' : 'degraded';
    const recovered = this.browserRuntime.getRecovered();

    const result: any = {
      status,
      running: isRunning,
      healthy,
      browserConnected: config.browserMode === 'persistent' ? true : browserConnected,
      contextAlive,
      persistent: config.browserMode === 'persistent',
      browserVersion,
      managedPages: this.browserRuntime.getManagedPagesCount(),
      manualPages: this.browserRuntime.getManualPagesCount(),
      browserData: config.userDataDir,
      headless: config.headless,
      lastRestart: this.browserRuntime.getLastRestartTime(),
      uptime: Math.round(uptimeMs / 1000),
      mode: config.browserMode,
      endpoint: this.browserRuntime.getCdpEndpoint(),
      connected: config.browserMode === 'persistent' ? true : browserConnected,
      ready,
      browserAlive: config.browserMode === 'persistent' ? true : browserConnected,
      contexts: this.browserRuntime.getContextsCount(),
      pages: this.browserRuntime.getPagesCount(),
      browserName: this.browserRuntime.getBrowserName(),
      lastReconnect: this.browserRuntime.getLastReconnectTime(),
      
      details: {
        runtime: isRunning ? 'running' : 'stopped',
        browser: (config.browserMode === 'persistent' ? isRunning : browserConnected) ? 'running' : 'stopped',
        mode: config.browserMode,
        headless: config.headless,
        amazon_context: amazonContextAlive,
        mercadolivre_context: mlContextAlive,
        managed_pages: this.browserRuntime.getManagedPagesCount(),
        manual_pages: this.browserRuntime.getManualPagesCount(),
        ready
      }
    };

    if (recovered) {
      result.recovered = true;
    }

    return result;
  }
}
