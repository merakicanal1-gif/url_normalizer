import { LocalBrowserRuntime } from '../../infrastructure/adapters/browser/LocalBrowserRuntime.js';

export class BrowserHealthService {
  constructor(private readonly browserRuntime: LocalBrowserRuntime) {}

  public async getStatus(): Promise<{
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
    // Novas informações Fase 3
    mode: 'cdp' | 'persistent';
    endpoint: string | null;
    connected: boolean;
    ready: boolean;
    browserAlive: boolean;
    contexts: number;
    pages: number;
    browserName: string;
    lastReconnect: string | null;
  }> {
    const isRunning = this.browserRuntime.getIsRunning();
    const contextAlive = this.browserRuntime.getIsContextAlive();
    const config = this.browserRuntime.getBrowserConfig();
    let browserVersion = 'unknown';
    let browserConnected = false;

    if (isRunning && contextAlive) {
      try {
        const context = await this.browserRuntime.getPersistentContext();
        const browser = context.browser();
        browserVersion = browser?.version() || 'unknown';
        browserConnected = browser?.isConnected() || false;
      } catch (err) {
        // Ignora erros
      }
    }

    const uptimeMs = isRunning ? Date.now() - this.browserRuntime.getStartTime() : 0;
    const healthy = isRunning && browserConnected && contextAlive;
    const recovered = this.browserRuntime.getRecovered();

    const response: any = {
      running: isRunning,
      healthy,
      browserConnected,
      contextAlive,
      contextOpen: contextAlive,
      persistent: config.browserMode === 'persistent',
      browserVersion,
      managedPages: this.browserRuntime.getManagedPagesCount(),
      manualPages: this.browserRuntime.getManualPagesCount(),
      browserData: config.userDataDir,
      headless: config.headless,
      lastRestart: this.browserRuntime.getLastRestartTime(),
      uptime: Math.round(uptimeMs / 1000),
      // Fase 3
      mode: config.browserMode,
      endpoint: this.browserRuntime.getCdpEndpoint(),
      connected: browserConnected,
      ready: healthy,
      browserAlive: browserConnected,
      contexts: this.browserRuntime.getContextsCount(),
      pages: this.browserRuntime.getPagesCount(),
      browserName: this.browserRuntime.getBrowserName(),
      lastReconnect: this.browserRuntime.getLastReconnectTime()
    };

    if (recovered) {
      response.recovered = true;
    }

    return response;
  }
}
