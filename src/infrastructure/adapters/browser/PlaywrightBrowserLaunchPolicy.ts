import { IBrowserLaunchPolicy, BrowserLaunchPolicyResult } from '../../../domain/ports/IBrowserLaunchPolicy.js';

export class PlaywrightBrowserLaunchPolicy implements IBrowserLaunchPolicy {
  constructor(
    private readonly environment: string = process.env.NODE_ENV || 'development',
    private readonly isStealthEnabled: boolean = process.env.PLAYWRIGHT_STEALTH !== 'false'
  ) {}

  public getLaunchOptions(type: 'worker' | 'interactive', profile?: any): BrowserLaunchPolicyResult {
    const isInteractive = type === 'interactive';
    const isHeadless = isInteractive ? false : true;

    // 1. Montar os argumentos de inicialização (Launch Options)
    const args: string[] = [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ];

    if (this.isStealthEnabled) {
      // Ocultar a flag navigator.webdriver no nível do mecanismo do Chromium
      args.push('--disable-blink-features=AutomationControlled');
      // Prevenir problemas de segurança de origem cruzada ao carregar recursos estáticos de CDNs (ex: Mercado Livre)
      args.push('--disable-web-security');
    }

    if (this.environment === 'production') {
      args.push('--disable-dev-shm-usage');
      args.push('--disable-gpu');
    }

    const launchOptions = {
      headless: isHeadless,
      args,
      devtools: isInteractive && this.environment === 'development' ? true : false,
      slowMo: isInteractive && this.environment === 'development' ? 50 : undefined
    };

    // 2. Montar as opções de Contexto (BrowserContext Options)
    const contextOptions = {
      locale: profile?.locale || 'pt-BR',
      timezoneId: profile?.timezoneId || 'America/Sao_Paulo',
      colorScheme: (profile?.colorScheme as 'light' | 'dark' | 'no-preference') || 'light',
      viewport: profile?.viewport !== undefined ? profile.viewport : { width: 1366, height: 768 },
      userAgent: profile?.userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      extraHTTPHeaders: profile?.extraHTTPHeaders || {
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Upgrade-Insecure-Requests': '1'
      },
      javaScriptEnabled: profile?.javaScriptEnabled !== undefined ? profile.javaScriptEnabled : true,
      acceptDownloads: isInteractive,
      permissions: ['geolocation', 'notifications']
    };

    // 3. Montar Scripts de Inicialização (Init Scripts)
    const initScripts: Array<{ source: string }> = [];

    if (this.isStealthEnabled) {
      // Injeção de script de evasão para garantir que qualquer detecção tardia via navigator.webdriver retorne undefined
      initScripts.push({
        source: 'Object.defineProperty(navigator, "webdriver", { get: () => undefined });'
      });
    }

    return {
      launchOptions,
      contextOptions,
      initScripts
    };
  }
}
