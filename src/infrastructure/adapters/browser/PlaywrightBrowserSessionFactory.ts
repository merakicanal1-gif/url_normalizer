import { IBrowserSessionFactory } from '../../../domain/ports/IBrowserSessionFactory.js';
import { IBrowserRuntime } from '../../../domain/ports/IBrowserRuntime.js';
import { IProfileManager } from '../../../domain/ports/IProfileManager.js';
import { BrowserProfile } from '../../../domain/models/BrowserProfile.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';
import { PlaywrightNavigatorPage } from './PlaywrightNavigatorPage.js';
import { BrowserContextFactory } from './BrowserContextFactory.js';

export class PlaywrightBrowserSessionFactory implements IBrowserSessionFactory {
  constructor(
    private browserRuntime: IBrowserRuntime,
    private profileManager: IProfileManager,
    private browserProfile: BrowserProfile,
    private contextFactory: BrowserContextFactory,
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {
    this.logger.info(`[PlaywrightBrowserSessionFactory] Inicializado com runtimeId=${(this.browserRuntime as any).runtimeId}`);
  }

  public async createSession(marketplace: string, profileId?: string): Promise<{
    page: INavigatorPage;
    dispose: () => Promise<void>;
  }> {
    this.logger.info(`[PlaywrightBrowserSessionFactory] Criando sessão worker para ${marketplace} (perfil: ${profileId || 'nenhum'})`);

    const browser = this.browserRuntime.getWorkerBrowser();
    let context: any;

    let storageState: any = null;
    if (profileId) {
      storageState = await this.profileManager.loadStorageState(marketplace, profileId);
    }

    if (storageState) {
      this.logger.info(`[PlaywrightBrowserSessionFactory] Criando contexto autenticado para o perfil: ${profileId}`);
      context = await this.contextFactory.createAuthenticatedContext(browser, storageState, this.browserProfile);
    } else {
      this.logger.info('[PlaywrightBrowserSessionFactory] Criando contexto anônimo.');
      context = await this.contextFactory.createAnonymousContext(browser, this.browserProfile);
    }

    const page = await context.newPage();
    const navigatorPage = new PlaywrightNavigatorPage(page, context);

    return {
      page: navigatorPage,
      dispose: async () => {
        this.logger.info(`[PlaywrightBrowserSessionFactory] Descartando sessão worker para ${marketplace}`);
        await page.close().catch(() => {});
        await this.contextFactory.disposeContext(context).catch(() => {});
      }
    };
  }

  public async createInteractiveSession(marketplace: string, profileId: string): Promise<{
    page: INavigatorPage;
    dispose: () => Promise<void>;
    storageState: () => Promise<any>;
  }> {
    this.logger.info(`[PlaywrightBrowserSessionFactory] Criando sessão interativa para ${marketplace}/${profileId}`);

    const browser = this.browserRuntime.getInteractiveBrowser();
    const context = await this.contextFactory.createInteractiveContext(browser, this.browserProfile);
    const page = await context.newPage();
    const navigatorPage = new PlaywrightNavigatorPage(page, context);

    return {
      page: navigatorPage,
      dispose: async () => {
        this.logger.info(`[PlaywrightBrowserSessionFactory] Descartando sessão interativa para ${marketplace}/${profileId}`);
        await page.close().catch(() => {});
        await this.contextFactory.disposeContext(context).catch(() => {});
      },
      storageState: async () => {
        return context.storageState();
      }
    };
  }
}
