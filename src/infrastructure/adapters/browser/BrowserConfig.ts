import * as fs from 'node:fs';
import * as path from 'node:path';

export class BrowserConfig {
  public readonly userDataDir: string;
  public readonly headless: boolean;
  public readonly viewport: { width: number; height: number };
  public readonly locale: string;
  public readonly timezone: string;
  public readonly userAgent: string;
  public readonly downloads: boolean;
  public readonly slowMo?: number;
  public readonly args: string[];
  public readonly browserMode: 'persistent' | 'cdp';
  public readonly cdpEndpoint: string;
    public readonly executablePath: string;
  public readonly autoStartBrowser: boolean;

  constructor() {
    this.browserMode = (process.env.BROWSER_MODE as 'persistent' | 'cdp') || 'persistent';
    this.cdpEndpoint = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9222';
    this.autoStartBrowser = process.env.AUTO_START_BROWSER !== 'false';
    this.executablePath = process.env.CHROME_PATH || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined as any);

    // 1. Resolver diretório principal e garantir sua existência
    const baseDataDir = path.resolve(process.env.SESSION_STORAGE_DIR || './data');
    this.userDataDir = path.join(baseDataDir, 'browser');

    // Garantir a estrutura de diretórios recomendada no plano
    const dirsToCreate = [
      baseDataDir,
      this.userDataDir,
      path.join(baseDataDir, 'downloads'),
      path.join(baseDataDir, 'screenshots'),
      path.join(baseDataDir, 'traces'),
      path.join(baseDataDir, 'videos')
    ];

    for (const dir of dirsToCreate) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // 2. Carregar configurações ambientais
    this.headless = process.env.PLAYWRIGHT_HEADLESS !== 'false' && process.env.BROWSER_HEADLESS !== 'false';
    this.viewport = {
      width: Number(process.env.BROWSER_VIEWPORT_WIDTH) || 1366,
      height: Number(process.env.BROWSER_VIEWPORT_HEIGHT) || 768
    };
    this.locale = process.env.BROWSER_LOCALE || 'pt-BR';
    this.timezone = process.env.BROWSER_TIMEZONE || 'America/Sao_Paulo';
    
    // User agent com fallback realista
    this.userAgent = process.env.BROWSER_USER_AGENT || 
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    this.downloads = process.env.BROWSER_DOWNLOADS !== 'false';
    this.slowMo = process.env.BROWSER_SLOW_MO ? Number(process.env.BROWSER_SLOW_MO) : undefined;

    // 3. Montar argumentos de inicialização do Chromium (Launch Options)
    const isStealth = process.env.PLAYWRIGHT_STEALTH !== 'false';
    const launchArgs: string[] = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-component-update',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-default-apps',
      '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-sync',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--password-store=basic',
      '--use-mock-keychain',
      '--js-flags=--max-old-space-size=256'
    ];

    if (isStealth) {
      launchArgs.push('--disable-blink-features=AutomationControlled');
      launchArgs.push('--disable-web-security');
    }

    this.args = launchArgs;
  }
}
