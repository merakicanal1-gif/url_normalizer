import * as path from 'node:path';
import { IProfileInspector, InspectionResult } from '../../../domain/ports/IProfileInspector.js';
import { IBrowserRuntime } from '../../../domain/ports/IBrowserRuntime.js';
import { IProfileRepository } from '../../../domain/ports/IProfileRepository.js';
import { BrowserContextFactory } from '../browser/BrowserContextFactory.js';
import { SecureCryptoHelper } from '../session/SecureCryptoHelper.js';
import { MarketplaceRegistry } from '../../../application/registry/MarketplaceRegistry.js';
import { BrowserProfile } from '../../../domain/models/BrowserProfile.js';
import { PlaywrightPageInspector } from '../browser/PlaywrightPageInspector.js';
import { PlaywrightNavigatorPage } from '../browser/PlaywrightNavigatorPage.js';

export class PlaywrightProfileInspector implements IProfileInspector {
  constructor(
    private browserRuntime: IBrowserRuntime,
    private repository: IProfileRepository,
    private contextFactory: BrowserContextFactory,
    private cryptoHelper: SecureCryptoHelper,
    private registry: MarketplaceRegistry,
    private browserProfile: BrowserProfile,
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {}

  public async inspect(
    marketplace: string,
    profileId: string,
    customUrl?: string,
    browserType?: 'interactive' | 'worker'
  ): Promise<InspectionResult> {
    const mkt = marketplace.toLowerCase();
    
    // 1. Identificar estratégia do marketplace correspondente
    let mockUrl = 'https://www.mercadolivre.com.br/';
    if (mkt === 'amazon') {
      mockUrl = 'https://www.amazon.com.br/';
    } else if (mkt === 'shopee') {
      mockUrl = 'https://shopee.com.br/';
    }
    const plugin = this.registry.resolve(new URL(mockUrl));
    const strategy = plugin.getAuthenticationStrategy();
    const validationUrl = strategy.getValidationUrl();
    const targetUrl = customUrl || validationUrl;

    // 2. Carregar perfil criptografado do repositório
    const localData = await this.repository.loadEncrypted(mkt, profileId);
    if (!localData) {
      throw new Error(`Profile ${profileId} not found in repository for marketplace ${marketplace}`);
    }

    const { metadata, storageStateEnc } = localData;
    const profileVersion = metadata.version || 1;

    // 3. Descriptografar e contar cookies
    let storageState: any = null;
    let cookiesCount = 0;
    let cookieDomains: string[] = [];

    if (storageStateEnc) {
      const decrypted = this.cryptoHelper.decrypt(storageStateEnc);
      storageState = JSON.parse(decrypted.plaintext);
      if (storageState && Array.isArray(storageState.cookies)) {
        cookiesCount = storageState.cookies.length;
        cookieDomains = Array.from(new Set(storageState.cookies.map((c: any) => c.domain || '')));
      }
    }

    // 4. Inicializar navegador correspondente
    const type = browserType || 'interactive';
    const browser = type === 'interactive' 
      ? this.browserRuntime.getInteractiveBrowser() 
      : this.browserRuntime.getWorkerBrowser();

    // 5. Criar BrowserContext
    const context = storageState
      ? await this.contextFactory.createAuthenticatedContext(browser, storageState, this.browserProfile)
      : await this.contextFactory.createAnonymousContext(browser, this.browserProfile);

    const page = await context.newPage();
    const navigatorPage = new PlaywrightNavigatorPage(page, context);

    // 6. Navegar para a URL de inspeção e aguardar networkidle
    await navigatorPage.goto(targetUrl, 30000);
    await page.waitForLoadState('networkidle').catch(() => {});

    const finalUrl = page.url();
    const pageTitle = await page.title().catch(() => '');

    // 7. Executar a estratégia de detecção funcional
    const pageInspector = new PlaywrightPageInspector(page);
    const detectResult = await strategy.detect(pageInspector);

    // 8. Registro de logs detalhados exigidos pelo usuário
    const storageDir = process.env.SESSION_STORAGE_DIR || path.join(process.cwd(), 'data', 'profiles');
    const storageStatePath = path.join(storageDir, mkt, profileId, 'storageState.enc');

    this.logger.info(JSON.stringify({
      msg: '[PlaywrightProfileInspector] Inspeção de perfil executada',
      storageStateLoaded: !!storageState,
      storageStatePath,
      browserContextCreated: true,
      cookiesLoaded: cookiesCount,
      cookieDomains,
      initialUrl: targetUrl,
      finalUrl,
      authenticationDetector: detectResult.status,
      authenticationReason: detectResult.reason,
      pageTitle,
      profileVersion,
      browserType: type
    }, null, 2));

    // 9. Retornar resposta rica (sem fechar o navegador)
    return {
      marketplace: mkt,
      profileId,
      storageStateLoaded: !!storageState,
      cookiesLoaded: cookiesCount,
      currentUrl: finalUrl,
      windowOpened: type === 'interactive',
      authenticated: detectResult.authenticated,
      detectorStatus: detectResult.status,
      confidence: detectResult.confidence,
      detector: {
        strategy: strategy.constructor.name,
        reason: detectResult.reason,
        status: detectResult.status,
        confidence: detectResult.confidence
      }
    };
  }
}
