import { IMarketplacePlugin } from '../../../domain/ports/IMarketplacePlugin.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';
import { NormalizedProduct } from '../../../domain/models/Product.js';
import { ChallengeDetectedError } from '../../../domain/errors/ChallengeDetectedError.js';
import { MarketplaceUnavailableError, MarketplacePageType } from '../../../domain/errors/MarketplaceUnavailableError.js';
import { IAuthenticationStrategy } from '../../../domain/ports/IAuthenticationStrategy.js';
import { AmazonAuthenticationStrategy } from './AmazonAuthenticationStrategy.js';
import { Page } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';

export class AmazonPlugin implements IMarketplacePlugin {
  constructor(
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {}

  public getAuthenticationStrategy(): IAuthenticationStrategy {
    return new AmazonAuthenticationStrategy();
  }

  public canHandle(url: URL): boolean {
    const res = /(^|\.)amazon\.(com|com\.br|es|it|fr|co\.uk)$/i.test(url.hostname);
    console.log(`[AmazonPlugin] [canHandle] URL recebida="${url.toString()}", Host="${url.hostname}", Resultado=${res}`);
    return res;
  }

  public getMarketplaceName(): string {
    return 'amazon';
  }

  public getInteractiveEntryUrl(): string {
    return 'https://www.amazon.com.br/gp/sign-in.html';
  }

  public async normalize(page: INavigatorPage, finalUrl: URL): Promise<NormalizedProduct> {
    console.log(`[AmazonPlugin] [extract/normalize] Iniciando extração. URL recebida="${finalUrl.toString()}"`);
    const rawPage: Page = (page as any).getRawPage();
    const artifactsDir = process.env.ARTIFACTS_DIR || path.join(process.cwd(), 'data', 'screenshots');
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    const title = await rawPage.title();
    const html = await rawPage.content();
    const lowerHtml = html.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const urlStr = finalUrl.toString();

    // 1. Classificação de Página
    let pageType: MarketplacePageType = 'UNKNOWN';
    let signatureMatched = '';

    if (lowerTitle === 'robot check' || lowerHtml.includes('/errors/validatecaptcha') || lowerHtml.includes('g-recaptcha')) {
      pageType = 'CAPTCHA_PAGE';
      signatureMatched = 'Robot Check / validatecaptcha / g-recaptcha';
    } else if (lowerTitle.includes('aws waf') || lowerHtml.includes('token.awswaf.com') || lowerHtml.includes('awswafintegration')) {
      pageType = 'WAF_PAGE';
      signatureMatched = 'AWS WAF / token.awswaf.com';
    } else if (urlStr.includes('/ap/signin') || urlStr.includes('/login') || urlStr.includes('/signin')) {
      pageType = 'LOGIN_PAGE';
      signatureMatched = '/ap/signin / /login / /signin';
    } else if (lowerTitle.includes('page not found') || lowerTitle.includes('página não encontrada') || lowerHtml.includes('we\'re sorry, we couldn\'t find that page')) {
      pageType = 'ERROR_PAGE';
      signatureMatched = 'Page Not Found';
    } else if (/\/(dp|gp\/product)\/([A-Z0-9]{10})/i.test(urlStr)) {
      pageType = 'PRODUCT_PAGE';
    }

    // Salvar screenshot para observabilidade
    const screenshotPath = path.join(artifactsDir, `amazon_classification_${pageType.toLowerCase()}.png`);
    await rawPage.screenshot({ path: screenshotPath }).catch(() => {});

    // Logs de Observabilidade
    this.logger.info(JSON.stringify({
      msg: "[AmazonPlugin] Página classificada",
      marketplace: this.getMarketplaceName(),
      classificacao: pageType,
      assinatura_encontrada: signatureMatched,
      url: urlStr,
      titulo: title,
      screenshot: screenshotPath,
      html_snippet: html.substring(0, 1000)
    }));

    // Tratar fluxos com base na classificação
    if (pageType === 'CAPTCHA_PAGE') {
      throw new ChallengeDetectedError(
        `Bloqueio de CAPTCHA detectado na Amazon: ${signatureMatched}`,
        'CAPTCHA'
      );
    }

    if (pageType === 'WAF_PAGE') {
      throw new ChallengeDetectedError(
        `Bloqueio de WAF detectado na Amazon: ${signatureMatched}`,
        'WAF'
      );
    }

    if (pageType === 'LOGIN_PAGE') {
      throw new ChallengeDetectedError(
        `Página de login exigida na Amazon: ${signatureMatched}`,
        'LOGIN'
      );
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

    // Se for PRODUCT_PAGE ou UNKNOWN, tenta extrair
    const asinMatch = /\/(dp|gp\/product)\/([A-Z0-9]{10})/i.exec(urlStr);
    if (!asinMatch) {
      throw new Error(`Não foi possível identificar o código do produto (ASIN) na URL: ${urlStr}`);
    }

    const productId = asinMatch[2].toUpperCase();
    const canonicalUrl = `https://${finalUrl.hostname}/dp/${productId}`;

    const extractedData = await page.evaluate<{ title: string; image: string }>(() => {
      const titleEl = document.querySelector('#productTitle');
      const titleText = titleEl ? titleEl.textContent?.trim() || '' : '';

      const imgEl = (
        document.querySelector('#landingImage') || 
        document.querySelector('#imgBlkFront') || 
        document.querySelector('#main-image') || 
        document.querySelector('#landingImageBack')
      ) as HTMLImageElement | null;

      let image = '';
      if (imgEl) {
        image = imgEl.src || imgEl.getAttribute('src') || '';
        const dynamicImgAttr = imgEl.getAttribute('data-a-dynamic-image');
        if (dynamicImgAttr) {
          try {
            const parsed = JSON.parse(dynamicImgAttr);
            const urls = Object.keys(parsed);
            if (urls.length > 0) {
              image = urls[urls.length - 1];
            }
          } catch (e) {
            // Ignora
          }
        }
      }

      return { title: titleText, image };
    });

    console.log(`[AmazonPlugin] [extract/normalize] Extração concluída. ASIN encontrado="${productId}", Imagem encontrada="${extractedData.image}"`);
    return {
      success: true,
      marketplace: this.getMarketplaceName(),
      url_final: canonicalUrl,
      id_produto: productId,
      titulo: extractedData.title,
      imagem: extractedData.image
    };
  }
}
