import { IPageClassifier } from '../../../../domain/ports/IPageClassifier.js';
import { INavigatorPage } from '../../../../domain/ports/INavigator.js';
import { PageInspection } from '../../../../domain/models/PageInspection.js';
import { MarketplacePageType } from '../../../../domain/errors/MarketplaceUnavailableError.js';
import { Page } from 'playwright-core';

export class MercadoLivrePageClassifier implements IPageClassifier {
  public async classify(page: INavigatorPage, url: string): Promise<PageInspection> {
    const rawPage: Page = (page as any).getRawPage();
    if (rawPage.isClosed()) {
      return {
        pageType: 'UNKNOWN',
        confidence: 0,
        url,
        hasCTA: false,
        hasProductImage: false,
        hasBuyBox: false,
        hasMLB: false,
        evidences: ['Page closed before classification']
      };
    }
    const title = await rawPage.title().catch(() => '');
    const html = await rawPage.content().catch(() => '');
    const lowerHtml = html.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const lowerUrl = url.toLowerCase();

    const evidences: string[] = [];
    let pageType: MarketplacePageType = 'UNKNOWN';

    // 1. Verificar bloqueios de segurança (WAF e Login explícito)
    if (lowerHtml.includes('token.awswaf.com') || lowerHtml.includes('awswafintegration')) {
      pageType = 'WAF_PAGE';
      evidences.push('Detected AWS WAF tokens/scripts in HTML content');
    } else if (lowerUrl.includes('registration-flows') || lowerUrl.includes('account-verification') || (lowerUrl.includes('/login') && !lowerUrl.includes('afiliados'))) {
      pageType = 'LOGIN_PAGE';
      evidences.push('URL indicates authentication page');
    } else if (lowerUrl.includes('/validatecaptcha') || lowerTitle.includes('robot check') || lowerTitle.includes('não sou um robô') || lowerTitle.includes('access denied')) {
      pageType = 'CAPTCHA_PAGE';
      evidences.push('Detected explicit robot check / validatecaptcha in HTML or Title');
    }

    // 2. Extrair dados estruturais para detecção posterior e pontuação de PDP
    const canonical = await rawPage.evaluate(() => {
      const link = document.querySelector('link[rel="canonical"]');
      return link ? link.getAttribute('href') || '' : '';
    });
    if (canonical) {
      evidences.push(`Canonical URL found: ${canonical}`);
    }

    const hasMLB = /MLB[U]?-?(\d+)/i.test(url) || (!!canonical && (/MLB[U]?-?(\d+)/i.test(canonical) || /\/p\/MLB/i.test(canonical) || /\/up\/MLB/i.test(canonical)));
    if (hasMLB) {
      evidences.push('MLB code present in current URL or Canonical URL');
    }

    const hasProductTitle = await rawPage.evaluate(() => {
      const el = document.querySelector('h1.ui-pdp-title, .ui-pdp-title, h1');
      return !!(el && el.textContent?.trim());
    });
    if (hasProductTitle) {
      evidences.push('Product title element (h1.ui-pdp-title or .ui-pdp-title) is present');
    }

    const hasBuyBox = await rawPage.evaluate(() => {
      return !!(document.querySelector('.ui-pdp-actions, [class*="ui-pdp-actions"], [class*="buybox"], form[action*="checkout"], .andes-button--loud'));
    });
    if (hasBuyBox) {
      evidences.push('PDP actions block (.ui-pdp-actions) found');
    }

    const hasProductImage = await rawPage.evaluate(() => {
      return !!(document.querySelector('img.ui-pdp-gallery__figure__image, .ui-pdp-gallery__figure__image img, .ui-pdp-gallery img, img[data-zoom]'));
    });
    if (hasProductImage) {
      evidences.push('PDP product gallery image is present');
    }

    const hasCTA = await rawPage.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, button, [role="button"], .ui-pdp-action--primary'));
      const textRegex = /ir (para )?(o )?produto|al producto|ver produto|comprar agora|acessar produto/i;
      const foundText = elements.some(el2 => textRegex.test(el2.textContent?.trim() || ''));
      if (foundText) return true;

      const productLink = document.querySelector('a[href*="produto.mercadolivre.com.br/MLB"], a[href*="/p/MLB"], a[href*="/up/MLB"]');
      return !!productLink;
    });
    if (hasCTA) {
      evidences.push('CTA primary button ("Ir para produto" / "Ir al producto") or featured product link visible');
    }

    // 3. Verificar erro estrutural ou página de lista/social/loja sem CTA
    const isSocialOrList = lowerUrl.includes('/social/') || lowerUrl.includes('/lists') || lowerUrl.includes('/perfil/');
    if (isSocialOrList) {
      evidences.push('Social profile or list detected');
    }

    const hasErrorPlaceholder = await rawPage.evaluate(() => {
      const placeholder = document.querySelector('.andes-placeholder__title') || 
                          document.querySelector('.ui-search-empty-state__title') || 
                          document.querySelector('.ui-empty-state') ||
                          document.querySelector('#error-page') ||
                          document.querySelector('.ui-error');
      return !!placeholder;
    });

    const isErrorTitle = lowerTitle.includes('página não encontrada') || 
                         lowerTitle.includes('página no encontrada') || 
                         lowerTitle.includes('erro') || 
                         lowerTitle.includes('error');

    const hasErrorTexts = lowerHtml.includes('não encontramos essa página') || 
                          lowerHtml.includes('no encontramos esa página') || 
                          lowerHtml.includes('parece que essa página não existe') || 
                          lowerHtml.includes('parece que esta página no existe') ||
                          lowerHtml.includes('id does not exist') ||
                          lowerHtml.includes('hubo un error accediendo a esta pagina');

    const isErrorPage = hasErrorPlaceholder || (isErrorTitle && hasErrorTexts) || lowerHtml.includes('id does not exist');
    if (isErrorPage) {
      evidences.push('Error structural page pattern matches');
    }

    // 4. Decisão inicial de pageType se ainda for UNKNOWN
    if (pageType === 'UNKNOWN') {
      if (hasProductTitle && hasBuyBox) {
        pageType = 'PRODUCT_PAGE';
      } else if (hasCTA) {
        pageType = 'AFFILIATE_LANDING';
      } else if (isErrorPage) {
        pageType = 'ERROR_PAGE';
      }
    }

    return {
      pageType,
      confidence: 0,
      url,
      canonical: canonical || undefined,
      title: title || undefined,
      hasCTA,
      hasProductImage,
      hasBuyBox,
      hasMLB,
      evidences
    };
  }
}
