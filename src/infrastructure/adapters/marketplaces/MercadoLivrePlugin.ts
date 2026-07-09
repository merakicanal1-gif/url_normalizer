import { IMarketplacePlugin } from '../../../domain/ports/IMarketplacePlugin.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';
import { NormalizedProduct } from '../../../domain/models/Product.js';
import { ChallengeDetectedError } from '../../../domain/errors/ChallengeDetectedError.js';
import { MarketplaceUnavailableError, MarketplacePageType } from '../../../domain/errors/MarketplaceUnavailableError.js';
import { Page } from 'playwright-core';
import * as path from 'path';

export class MercadoLivrePlugin implements IMarketplacePlugin {
  constructor(
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {}

  public canHandle(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return host.includes('mercadolivre.com') || host.includes('mercadolibre.com') || host.includes('meli.la');
  }

  public getMarketplaceName(): string {
    return 'mercadolivre';
  }

  public getInteractiveEntryUrl(): string {
    return 'https://www.mercadolivre.com.br/';
  }

  private async classifyPage(rawPage: Page, urlStr: string): Promise<{ type: MarketplacePageType; signature: string }> {
    const title = await rawPage.title();
    const html = await rawPage.content();
    const lowerHtml = html.toLowerCase();
    const lowerTitle = title.toLowerCase();

    const buttonLocator = rawPage.locator('a, button, [role="button"]').filter({ hasText: /ir para (o )?produto/i });
    const isSocialPage = urlStr.includes('/social/');
    const hasProductButton = (await buttonLocator.count()) > 0;

    if (lowerHtml.includes('hubo un error accediendo a esta pagina') || lowerHtml.includes('ir a la página principal')) {
      return { type: 'ERROR_PAGE', signature: 'Hubo un error accediendo a esta pagina / Ir a la página principal' };
    }
    if (lowerHtml.includes('token.awswaf.com') || lowerHtml.includes('awswafintegration')) {
      return { type: 'WAF_PAGE', signature: 'AWS WAF' };
    }
    if (lowerHtml.includes('captchacharacters') || lowerHtml.includes('/errors/validatecaptcha') || lowerTitle.includes('robot check') || lowerTitle.includes('access denied')) {
      return { type: 'CAPTCHA_PAGE', signature: 'Robot Check / CAPTCHA' };
    }
    if (urlStr.includes('/ap/signin') || urlStr.includes('/login') || urlStr.includes('/signin') || urlStr.includes('/gz/account-verification')) {
      return { type: 'LOGIN_PAGE', signature: '/login / account-verification' };
    }
    if (isSocialPage || hasProductButton) {
      return { type: 'AFFILIATE_LANDING', signature: '/social/ or button: Ir para produto' };
    }
    if (/MLB-?(\d+)/i.test(urlStr)) {
      return { type: 'PRODUCT_PAGE', signature: 'MLB Product Code matched in URL' };
    }
    return { type: 'UNKNOWN', signature: '' };
  }

  public async normalize(page: INavigatorPage, finalUrl: URL): Promise<NormalizedProduct> {
    const rawPage: Page = (page as any).getRawPage();
    let currentUrl = finalUrl;
    const artifactsDir = '/home/emerson/.gemini/antigravity/brain/05de339f-7fba-4351-88c9-deae9581afd6';

    this.logger.info(`[MercadoLivrePlugin] normalize() iniciado. URL: ${finalUrl.toString()}`);

    // 1. Classificação Inicial
    let { type: pageType, signature: signatureMatched } = await this.classifyPage(rawPage, currentUrl.toString());

    // Salvar screenshot inicial para observabilidade
    const screenshotPath = path.join(artifactsDir, `ml_classification_${pageType.toLowerCase()}_initial.png`);
    await rawPage.screenshot({ path: screenshotPath }).catch(() => {});

    this.logger.info(JSON.stringify({
      msg: "[MercadoLivrePlugin] Página classificada inicialmente",
      marketplace: this.getMarketplaceName(),
      classificacao: pageType,
      assinatura_encontrada: signatureMatched,
      url: currentUrl.toString(),
      titulo: await rawPage.title(),
      screenshot: screenshotPath
    }));

    // Se for ERROR_PAGE, interrompe imediatamente sem procurar MLB
    if (pageType === 'ERROR_PAGE') {
      throw new MarketplaceUnavailableError(
        'O marketplace retornou uma página de erro durante a navegação.',
        'ERROR_PAGE',
        await rawPage.title(),
        currentUrl.toString(),
        this.getMarketplaceName(),
        signatureMatched,
        screenshotPath,
        (await rawPage.content()).substring(0, 500)
      );
    }

    if (pageType === 'CAPTCHA_PAGE') {
      throw new ChallengeDetectedError(`Bloqueio de CAPTCHA detectado no Mercado Livre: ${signatureMatched}`, 'CAPTCHA');
    }

    if (pageType === 'WAF_PAGE') {
      throw new ChallengeDetectedError(`Bloqueio de WAF detectado no Mercado Livre: ${signatureMatched}`, 'WAF');
    }

    if (pageType === 'LOGIN_PAGE') {
      throw new ChallengeDetectedError(`Página de login/verificação exigida no Mercado Livre: ${signatureMatched}`, 'LOGIN');
    }

    // 2. Recuperação de Navegação para AFFILIATE_LANDING
    if (pageType === 'AFFILIATE_LANDING') {
      const buttonLocator = rawPage.locator('a, button, [role="button"]').filter({ hasText: /ir para (o )?produto/i });
      const hasProductButton = (await buttonLocator.count()) > 0;

      if (hasProductButton) {
        const button = buttonLocator.first();
        this.logger.info(`[MercadoLivrePlugin] Executando clique de recuperação na landing de afiliado...`);
        try {
          await Promise.all([
            rawPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }),
            button.click({ timeout: 5000 })
          ]);
        } catch (err: any) {
          this.logger.error(`[MercadoLivrePlugin] Erro durante clique na landing`, err);
        }

        // Re-classificar página pós-navegação
        currentUrl = new URL(rawPage.url());
        const reclassified = await this.classifyPage(rawPage, currentUrl.toString());
        pageType = reclassified.type;
        signatureMatched = reclassified.signature;

        const postScreenshotPath = path.join(artifactsDir, `ml_classification_${pageType.toLowerCase()}_post.png`);
        await rawPage.screenshot({ path: postScreenshotPath }).catch(() => {});

        this.logger.info(JSON.stringify({
          msg: "[MercadoLivrePlugin] Página re-classificada pós-clique",
          marketplace: this.getMarketplaceName(),
          classificacao: pageType,
          assinatura_encontrada: signatureMatched,
          url: currentUrl.toString(),
          titulo: await rawPage.title(),
          screenshot: postScreenshotPath
        }));

        if (pageType === 'ERROR_PAGE') {
          throw new MarketplaceUnavailableError(
            'O marketplace retornou uma página de erro pós-clique durante a navegação.',
            'ERROR_PAGE',
            await rawPage.title(),
            currentUrl.toString(),
            this.getMarketplaceName(),
            signatureMatched,
            postScreenshotPath,
            (await rawPage.content()).substring(0, 500)
          );
        }
      }
    }

    // Extrair o ID do produto
    const mlbMatch = /MLB-?(\d+)/i.exec(currentUrl.toString());
    if (!mlbMatch) {
      throw new Error(`Não foi possível identificar o código do produto (MLB) na URL: ${currentUrl.toString()}`);
    }

    const productId = `MLB${mlbMatch[1]}`;
    const canonicalUrl = `https://produto.mercadolivre.com.br/${productId}-${productId.substring(3)}`;

    const extractedData = await page.evaluate<{ title: string; image: string }>(() => {
      const titleEl = document.querySelector('h1.ui-pdp-title') || document.querySelector('.ui-pdp-title') || document.querySelector('h1');
      const title = titleEl ? titleEl.textContent?.trim() || '' : document.title;

      const imgEl = (document.querySelector('img.ui-pdp-gallery__figure__image') || document.querySelector('img.ui-pdp-image') || document.querySelector('.ui-pdp-gallery__figure__image img')) as HTMLImageElement | null;
      let image = imgEl ? imgEl.getAttribute('src') || imgEl.src || '' : '';

      if (!image) {
        const ogImg = document.querySelector('meta[property="og:image"]');
        image = ogImg ? ogImg.getAttribute('content') || '' : '';
      }

      return { title, image };
    });

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
