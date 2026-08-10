import { IMarketplacePlugin } from '../../../domain/ports/IMarketplacePlugin.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';
import { NormalizedProduct } from '../../../domain/models/Product.js';
import { ChallengeDetectedError } from '../../../domain/errors/ChallengeDetectedError.js';
import { MarketplaceUnavailableError, MarketplacePageType } from '../../../domain/errors/MarketplaceUnavailableError.js';
import { ProductNotFoundError } from '../../../domain/errors/ProductNotFoundError.js';
import { ProductUnavailableError } from '../../../domain/errors/ProductUnavailableError.js';
import { AffiliateLinkError } from '../../../domain/errors/AffiliateLinkError.js';
import { IAuthenticationStrategy } from '../../../domain/ports/IAuthenticationStrategy.js';
import { AmazonAuthenticationStrategy } from './AmazonAuthenticationStrategy.js';
import { Page } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';
import { parsePrice } from './PriceParser.js';

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
    const rawPage: Page = (page as any).getRawPage();
    const urlStr = finalUrl.toString();

    // 1. Extrair ASIN imediatamente da URL
    const asinMatch = /\/(dp|gp\/product)\/([A-Z0-9]{10})/i.exec(urlStr);
    if (!asinMatch) {
      throw new ProductNotFoundError();
    }

    const productId = asinMatch[2].toUpperCase();
    const canonicalUrl = `https://${finalUrl.hostname}/dp/${productId}`;
    const tag = process.env.AMAZON_AFFILIATE_TAG || '17072212-20';
    const link_afiliado = `${canonicalUrl}?tag=${tag}`;

    // 2. Aguardar o produto anexar no DOM e carregar via polling paciente
    let extractedData = { title: '', image: '' };

    try {
      await rawPage.waitForSelector('#productTitle, #title, #landingImage, #main-image, h1', { state: 'attached', timeout: 6000 }).catch(() => {});
    } catch (_) {}

    for (let attempt = 0; attempt < 8; attempt++) {
      extractedData = await page.evaluate<{ title: string; image: string }>(() => {
        const titleEl = document.querySelector('#productTitle') || document.querySelector('#title') || document.querySelector('h1#title') || document.querySelector('#centerCol h1');
        let titleText = titleEl ? titleEl.textContent?.trim() || '' : '';
        
        if (!titleText) {
          const metaTitle = document.querySelector('meta[property="og:title"]');
          if (metaTitle) {
            titleText = (metaTitle.getAttribute('content') || '').replace(/^Amazon\.com\.br\s*:\s*/i, '').trim();
          }
        }
        if (!titleText && document.title && !document.title.toLowerCase().includes('robot check') && !document.title.toLowerCase().includes('404')) {
          titleText = document.title.replace(/^Amazon\.com\.br\s*:\s*/i, '').replace(/:\s*Amazon\.com\.br.*/i, '').trim();
        }

        let image = '';
        const imgEl = (
          document.querySelector('#landingImage') || 
          document.querySelector('#imgBlkFront') || 
          document.querySelector('#main-image') || 
          document.querySelector('#landingImageBack') ||
          document.querySelector('.a-dynamic-image') ||
          document.querySelector('#main-image-container img')
        ) as HTMLImageElement | null;

        if (imgEl) {
          const dynamicImgAttr = imgEl.getAttribute('data-a-dynamic-image');
          if (dynamicImgAttr) {
            try {
              const parsed = JSON.parse(dynamicImgAttr);
              const urls = Object.keys(parsed);
              if (urls.length > 0) image = urls[urls.length - 1];
            } catch (_) {}
          }
          if (!image) {
            image = imgEl.src || imgEl.getAttribute('src') || '';
          }
        }

        if (!image || image.startsWith('data:')) {
          const metaImg = document.querySelector('meta[property="og:image"]');
          if (metaImg) image = metaImg.getAttribute('content') || '';
        }

        return { title: titleText, image };
      });

      if (extractedData.title) {
        break;
      }
      await rawPage.waitForTimeout(600);
    }

    if (!extractedData.title) {
      const title = await rawPage.title().catch(() => '');
      if (title.toLowerCase().includes('robot check') || title.toLowerCase().includes('não sou um robô')) {
        throw new ChallengeDetectedError('Bloqueio de CAPTCHA detectado na Amazon', 'CAPTCHA');
      }
      throw new ProductUnavailableError();
    }

    this.logger.info(`[AmazonPlugin] Extração relâmpago concluída: ASIN=${productId}, Título="${extractedData.title}"`);
    return {
      success: true,
      marketplace: this.getMarketplaceName(),
      id_produto: productId,
      nome_produto: extractedData.title,
      url_imagem: extractedData.image || null,
      url_produto: canonicalUrl,
      link_afiliado,
      mensagem: null,
      preco_anterior: null,
      preco_atual: null
    };
  }
}
