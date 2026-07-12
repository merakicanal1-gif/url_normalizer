import { IProductExtractor } from '../../../../domain/ports/IProductExtractor.js';
import { INavigatorPage } from '../../../../domain/ports/INavigator.js';
import { NormalizedProduct } from '../../../../domain/models/Product.js';
import { Page } from 'playwright-core';

export class MercadoLivreProductExtractor implements IProductExtractor {
  constructor(
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {}

  public async extract(page: INavigatorPage, url: string, marketplaceName: string): Promise<NormalizedProduct> {
    const rawPage: Page = (page as any).getRawPage();
    
    const mlbMatch = /MLB-?(\d+)/i.exec(url);
    if (!mlbMatch) {
      throw new Error(`Não foi possível identificar o código do produto (MLB) na URL: ${url}`);
    }
    const productId = `MLB${mlbMatch[1]}`;

    const canonicalUrl = await rawPage.evaluate(() => {
      const link = document.querySelector('link[rel="canonical"]');
      return link ? link.getAttribute('href') : '';
    }) || url;

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

    this.logger.info(`[ProductExtractor] Extracted details for product ${productId}. Title: "${extractedData.title}"`);

    return {
      success: true,
      marketplace: marketplaceName,
      url_final: canonicalUrl,
      id_produto: productId,
      titulo: extractedData.title,
      imagem: extractedData.image
    };
  }
}
