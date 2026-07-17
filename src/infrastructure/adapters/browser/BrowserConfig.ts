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
  public readonly autoStartBrowser: boolean;

  constructor() {
    this.browserMode = (process.env.BROWSER_MODE as 'persistent' | 'cdp') || 'persistent';
    this.cdpEndpoint = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9222';
    this.autoStartBrowser = process.env.AUTO_START_BROWSER !== 'false';

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
    this.headless = process.env.BROWSER_HEADLESS === 'true';
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
      '--disable-setuid-sandbox'
    ];

    if (isStealth) {
      launchArgs.push('--disable-blink-features=AutomationControlled');
      launchArgs.push('--disable-web-security');
    }

    if (process.env.NODE_ENV === 'production') {
      launchArgs.push('--disable-dev-shm-usage');
      launchArgs.push('--disable-gpu');
    }

    this.args = launchArgs;
  }
}
