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

    // 2. Aguardar o título ou imagem do produto anexar no DOM (instantâneo via streaming)
    try {
      await rawPage.waitForSelector('#productTitle, h1#title, #landingImage, .a-price', { state: 'attached', timeout: 2500 });
    } catch (_) {}

    // 3. Extrair Título e Imagem diretamente via DOM em uma única avaliação rápida
    const extractedData = await page.evaluate<{ title: string; image: string }>(() => {
      const titleEl = document.querySelector('#productTitle') || document.querySelector('h1#title') || document.querySelector('h1');
      const titleText = titleEl ? titleEl.textContent?.trim() || '' : document.title.replace(/amazon\.com(\.br)?/i, '').trim();

      const imgEl = (
        document.querySelector('#landingImage') || 
        document.querySelector('#imgBlkFront') || 
        document.querySelector('#main-image') || 
        document.querySelector('#landingImageBack') ||
        document.querySelector('.a-dynamic-image')
      ) as HTMLImageElement | null;

      let image = '';
      if (imgEl) {
        image = imgEl.src || imgEl.getAttribute('src') || '';
        const dynamicImgAttr = imgEl.getAttribute('data-a-dynamic-image');
        if (dynamicImgAttr) {
          try {
            const parsed = JSON.parse(dynamicImgAttr);
            const urls = Object.keys(parsed);
            if (urls.length > 0) image = urls[urls.length - 1];
          } catch (_) {}
        }
      }

      if (!image) {
        const metaImg = document.querySelector('meta[property="og:image"]');
        if (metaImg) image = metaImg.getAttribute('content') || '';
      }

      return { title: titleText, image };
    });

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
