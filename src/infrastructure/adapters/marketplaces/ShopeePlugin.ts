import { IMarketplacePlugin } from '../../../domain/ports/IMarketplacePlugin.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';
import { NormalizedProduct } from '../../../domain/models/Product.js';
import { ChallengeDetectedError } from '../../../domain/errors/ChallengeDetectedError.js';
import { MarketplaceUnavailableError, MarketplacePageType } from '../../../domain/errors/MarketplaceUnavailableError.js';
import { IAuthenticationStrategy } from '../../../domain/ports/IAuthenticationStrategy.js';
import { ShopeeAuthenticationStrategy } from './ShopeeAuthenticationStrategy.js';
import { Page } from 'playwright-core';
import * as path from 'path';

import { MarketplaceHostRegistry } from '../../../domain/services/MarketplaceHostRegistry.js';

export class ShopeePlugin implements IMarketplacePlugin {
  constructor(
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {}

  public getAuthenticationStrategy(): IAuthenticationStrategy {
    return new ShopeeAuthenticationStrategy();
  }

  public canHandle(url: URL): boolean {
    return MarketplaceHostRegistry.isShopee(url.hostname);
  }

  public getMarketplaceName(): string {
    return 'shopee';
  }

  public getInteractiveEntryUrl(): string {
    return 'https://shopee.com.br/';
  }

  public async normalize(page: INavigatorPage, finalUrl: URL): Promise<NormalizedProduct> {
    const rawPage: Page = (page as any).getRawPage();
    const artifactsDir = '/home/emerson/.gemini/antigravity/brain/05de339f-7fba-4351-88c9-deae9581afd6';

    const title = await rawPage.title();
    const html = await rawPage.content();
    const lowerHtml = html.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const urlStr = finalUrl.toString();

    // 1. Classificação de Página
    let pageType: MarketplacePageType = 'UNKNOWN';
    let signatureMatched = '';

    if (lowerHtml.includes('captcha') || lowerHtml.includes('g-recaptcha') || lowerTitle.includes('robot check')) {
      pageType = 'CAPTCHA_PAGE';
      signatureMatched = 'Captcha / robot check';
    } else if (urlStr.includes('/login') || lowerHtml.includes('shopee-login-page') || lowerHtml.includes('passaporte.shopee')) {
      pageType = 'LOGIN_PAGE';
      signatureMatched = '/login / shopee-login-page';
    } else if (lowerTitle.includes('error') || lowerHtml.includes('forbidden') || lowerHtml.includes('bloqueado') || lowerHtml.includes('páginas de erro') || lowerHtml.includes('something went wrong')) {
      pageType = 'ERROR_PAGE';
      signatureMatched = 'Error page / forbidden / blocked';
    } else if (/i\.(\d+)\.(\d+)/i.test(urlStr)) {
      pageType = 'PRODUCT_PAGE';
    }

    // Salvar screenshot para observabilidade
    const screenshotPath = path.join(artifactsDir, `shopee_classification_${pageType.toLowerCase()}.png`);
    await rawPage.screenshot({ path: screenshotPath }).catch(() => {});

    // Logs de Observabilidade
    this.logger.info(JSON.stringify({
      msg: "[ShopeePlugin] Página classificada",
      marketplace: this.getMarketplaceName(),
      classificacao: pageType,
      assinatura_encontrada: signatureMatched,
      url: urlStr,
      titulo: title,
      screenshot: screenshotPath,
      html_snippet: html.substring(0, 1000)
    }));

    if (pageType === 'CAPTCHA_PAGE') {
      throw new ChallengeDetectedError(`Bloqueio de CAPTCHA detectado na Shopee: ${signatureMatched}`, 'CAPTCHA');
    }

    if (pageType === 'LOGIN_PAGE') {
      throw new ChallengeDetectedError(`Página de login exigida na Shopee: ${signatureMatched}`, 'LOGIN');
    }

    if (pageType === 'ERROR_PAGE') {
      throw new MarketplaceUnavailableError(
        'O marketplace retornou uma página de erro durante a navegação.',
        'ERROR_PAGE',
        title,
        urlStr,
        this.getMarketplaceName(),
        signatureMatched,
        screenshotPath,
        html.substring(0, 500)
      );
    }

    // Extrair ID do produto da Shopee (i.shopId.productId)
    const shopeeMatch = /i\.(\d+)\.(\d+)/i.exec(urlStr);
    if (!shopeeMatch) {
      throw new Error(`Não foi possível identificar o código do produto na URL: ${urlStr}`);
    }

    const shopId = shopeeMatch[1];
    const productId = shopeeMatch[2];
    const canonicalUrl = `https://shopee.com.br/product-i.${shopId}.${productId}`;

    const extractedData = await page.evaluate<{ title: string; image: string }>(() => {
      // Extração simplificada de título e imagem de Shopee PDP
      const titleEl = document.querySelector('span') || document.querySelector('h1');
      const title = titleEl ? titleEl.textContent?.trim() || '' : document.title;

      const imgEl = document.querySelector('img') as HTMLImageElement | null;
      const image = imgEl ? imgEl.src || imgEl.getAttribute('src') || '' : '';

      return { title, image };
    });

    return {
      success: true,
      marketplace: this.getMarketplaceName(),
      url_final: canonicalUrl,
      id_produto: `${shopId}.${productId}`,
      titulo: extractedData.title,
      imagem: extractedData.image
    };
  }
}
