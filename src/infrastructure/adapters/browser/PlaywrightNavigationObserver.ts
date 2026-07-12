import { INavigatorPage } from '../../../domain/ports/INavigator.js';
import { INavigationObserver } from '../../../domain/ports/INavigationObserver.js';
import { Page } from 'playwright-core';

export class PlaywrightNavigationObserver implements INavigationObserver {
  constructor(
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {}

  public async waitForTransition(page: INavigatorPage, pendingClick?: Promise<void> | null): Promise<string> {
    const rawPage: Page = (page as any).getRawPage();
    const stateStartTime = performance.now();
    this.logger.info(`[NavigationObserver] Iniciando esperas simultâneas pós-clique...`);

    if (pendingClick) {
      await pendingClick.catch((e: any) => {
        this.logger.info(`[NavigationObserver] Erro capturado da ação pendente: ${e.message}`);
      });
    }

    const initialUrl = rawPage.url();
    const urlChangePromise = new Promise<string>((resolve) => {
      const check = () => {
        try {
          const currentUrl = rawPage.url();
          if (currentUrl !== initialUrl && (/MLB-?(\d+)/i.test(currentUrl) || /\/(dp|gp\/product)\/([A-Z0-9]{10})/i.test(currentUrl))) {
            resolve('url_changed_product');
          } else {
            setTimeout(check, 250);
          }
        } catch (e) {
          resolve('url_check_error');
        }
      };
      check();
    });

    const pdpElementPromise = rawPage.waitForSelector('h1.ui-pdp-title, .ui-pdp-title, .ui-pdp-actions, #productTitle, #landingImage', { timeout: 8000 })
      .then(() => 'pdp_element_visible')
      .catch(() => 'pdp_element_timeout');

    const playwrightNavigationPromise = rawPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 })
      .then(() => 'traditional_navigation')
      .catch(() => 'navigation_timeout');

    const raceResult = await Promise.race([
      urlChangePromise,
      pdpElementPromise,
      playwrightNavigationPromise
    ]);

    const duration = Math.round(performance.now() - stateStartTime);
    this.logger.info(`[NavigationObserver] Transição concluída. Vencedor=${raceResult} em ${duration}ms.`);
    return raceResult;
  }
}
