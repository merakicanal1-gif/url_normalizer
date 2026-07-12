import { IPageClassifier } from '../../../../domain/ports/IPageClassifier.js';
import { INavigatorPage } from '../../../../domain/ports/INavigator.js';
import { PageInspection } from '../../../../domain/models/PageInspection.js';
import { MarketplacePageType } from '../../../../domain/errors/MarketplaceUnavailableError.js';
import { Page } from 'playwright-core';

export class MercadoLivrePageClassifier implements IPageClassifier {
  public async classify(page: INavigatorPage, url: string): Promise<PageInspection> {
    const rawPage: Page = (page as any).getRawPage();
    const title = await rawPage.title();
    const html = await rawPage.content();
    const lowerHtml = html.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const lowerUrl = url.toLowerCase();

    const evidences: string[] = [];
    let pageType: MarketplacePageType = 'UNKNOWN';

    // 1. Verificar bloqueios de segurança (WAF e CAPTCHA)
    if (lowerHtml.includes('token.awswaf.com') || lowerHtml.includes('awswafintegration')) {
      pageType = 'WAF_PAGE';
      evidences.push('Detected AWS WAF tokens/scripts in HTML content');
    } else if (
      lowerHtml.includes('captchacharacters') ||
      lowerHtml.includes('/errors/validatecaptcha') ||
      lowerHtml.includes('g-recaptcha') ||
      lowerTitle.includes('robot check') ||
      lowerTitle.includes('access denied')
    ) {
      pageType = 'CAPTCHA_PAGE';
      evidences.push('Detected robot check / validatecaptcha in HTML or Title');
    } else if (
      lowerUrl.includes('/ap/signin') ||
      lowerUrl.includes('/login') ||
      lowerUrl.includes('/signin') ||
      lowerUrl.includes('/gz/account-verification')
    ) {
      pageType = 'LOGIN_PAGE';
      evidences.push('URL indicates authentication page');
    }

    // 2. Extrair dados estruturais para detecção posterior e pontuação de PDP
    const canonical = await rawPage.evaluate(() => {
      const link = document.querySelector('link[rel="canonical"]');
      return link ? link.getAttribute('href') || '' : '';
    });
    if (canonical) {
      evidences.push(`Canonical URL found: ${canonical}`);
    }

    const hasMLB = /MLB-?(\d+)/i.test(url) || (!!canonical && (/MLB-?(\d+)/i.test(canonical) || /\/p\/MLB/i.test(canonical)));
    if (hasMLB) {
      evidences.push('MLB code present in current URL or Canonical URL');
    }

    const hasProductTitle = await rawPage.evaluate(() => {
      const el = document.querySelector('h1.ui-pdp-title') || document.querySelector('.ui-pdp-title');
      return !!(el && el.textContent?.trim());
    });
    if (hasProductTitle) {
      evidences.push('Product title element (h1.ui-pdp-title or .ui-pdp-title) is present');
    }

    const hasBuyBox = await rawPage.evaluate(() => {
      return !!(document.querySelector('.ui-pdp-actions') || document.querySelector('[class*="ui-pdp-actions"]'));
    });
    if (hasBuyBox) {
      evidences.push('PDP actions block (.ui-pdp-actions) found');
    }

    const hasProductImage = await rawPage.evaluate(() => {
      return !!(document.querySelector('img.ui-pdp-gallery__figure__image') || document.querySelector('.ui-pdp-gallery__figure__image img'));
    });
    if (hasProductImage) {
      evidences.push('PDP product gallery image is present');
    }

    const hasCTA = await rawPage.evaluate(() => {
      const el = document.querySelector('[data-testid*="product"], [aria-label*="produto"], [aria-label*="producto"]');
      if (el) return true;
      const elements = Array.from(document.querySelectorAll('a, button, [role="button"]'));
      const textRegex = /ir (para (o )?produto|al producto)/i;
      return elements.some(el2 => textRegex.test(el2.textContent || ''));
    });
    if (hasCTA) {
      evidences.push('CTA primary button ("Ir para o produto" / "Ir al producto") visible or has testid/aria-label');
    }

    // 3. Verificar erro estrutural
    const hasErrorPlaceholder = await rawPage.evaluate(() => {
      const placeholder = document.querySelector('.andes-placeholder__title') || 
                          document.querySelector('.ui-search-empty-state__title') || 
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
                          lowerHtml.includes('hubo un error accediendo a esta pagina');

    const isErrorPage = hasErrorPlaceholder || (isErrorTitle && hasErrorTexts);
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
