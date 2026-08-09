import { IBrowserSessionFactory } from '../../../domain/ports/IBrowserSessionFactory.js';
import { IBrowserRuntime } from '../../../domain/ports/IBrowserRuntime.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';
import { PlaywrightNavigatorPage } from './PlaywrightNavigatorPage.js';

export class PlaywrightBrowserSessionFactory implements IBrowserSessionFactory {
  constructor(
    private readonly browserRuntime: IBrowserRuntime,
    private readonly logger?: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {
    if (this.logger) {
      this.logger.info('[PlaywrightBrowserSessionFactory] Inicializado com runtime persistente.');
    }
  }

  public async createSession(marketplace: string, profileId?: string): Promise<{
    page: INavigatorPage;
    dispose: () => Promise<void>;
  }> {
    if (this.logger) {
      this.logger.info(`[PlaywrightBrowserSessionFactory] Criando sessão gerenciada para o marketplace: ${marketplace}`);
    }

    // Criar aba marcada como gerenciada (isManaged = true) repassando o marketplace
    const page = await this.browserRuntime.newPage(true, marketplace);
    const navigatorPage = new PlaywrightNavigatorPage(page);

    return {
      page: navigatorPage,
      dispose: async () => {
        if (this.logger) {
          this.logger.info(`[PlaywrightBrowserSessionFactory] Descartando página gerenciada para o marketplace: ${marketplace}`);
        }
        // No modo CDP, salva o estado da sessão no dispose caso de fechamento do browser
        const isCdp = (this.browserRuntime as any).getConnectedViaCDP?.();
        if (isCdp) {
          try {
            const key = marketplace.toLowerCase();
            const statePath = `./data/session_${key}.json`;
            await page.context().storageState({ path: statePath });
          } catch (err: any) {
            // Ignorar se a página/contexto já estiver fechada
          }
        }
        await this.browserRuntime.closePage(page);
      }
    };
  }
}
