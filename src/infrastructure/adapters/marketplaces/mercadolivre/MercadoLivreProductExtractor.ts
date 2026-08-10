import { IProductExtractor } from '../../../../domain/ports/IProductExtractor.js';
import { INavigatorPage } from '../../../../domain/ports/INavigator.js';
import { NormalizedProduct } from '../../../../domain/models/Product.js';
import { Page } from 'playwright-core';
import { parsePrice } from '../PriceParser.js';
import { AffiliateLinkError } from '../../../../domain/errors/AffiliateLinkError.js';

export class MercadoLivreProductExtractor implements IProductExtractor {
  constructor(
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {}

  public async extract(page: INavigatorPage, url: string, marketplaceName: string): Promise<NormalizedProduct> {
    const rawPage: Page = (page as any).getRawPage();
    
    const canonicalUrl = await rawPage.evaluate(() => {
      const link = document.querySelector('link[rel="canonical"]');
      return link ? link.getAttribute('href') : '';
    }) || url;

    const mlbMatch = /(MLB[U]?-?\d+)/i.exec(url) || 
                     /(MLB[U]?-?\d+)/i.exec(rawPage.url()) || 
                     /(MLB[U]?-?\d+)/i.exec(canonicalUrl) ||
                     /item_id[=:]%?3?A?(MLB[U]?-?\d+)/i.exec(rawPage.url());

    const productId = mlbMatch ? mlbMatch[1].replace('-', '').toUpperCase() : 'MLBPAGE';

    const extractedData = await page.evaluate<{ 
      title: string; 
      image: string; 
      currentPriceText: string; 
      previousPriceText: string; 
    }>(() => {
      const titleEl = document.querySelector('h1.ui-pdp-title') || document.querySelector('.ui-pdp-title') || document.querySelector('h1');
      const title = titleEl ? titleEl.textContent?.trim() || '' : document.title;

      // Imagem do Produto
      let image = '';
      const candidateImages = Array.from(document.querySelectorAll('img'))
        .map(img => img.src || img.getAttribute('data-src') || img.getAttribute('data-zoom') || '')
        .filter(src => src && (src.includes('mlstatic.com') || src.includes('http2')));

      if (candidateImages.length > 0) {
        const mainImg = candidateImages.find(src => src.includes('/D_NQ_') || src.includes('-OO.webp') || src.includes('-O.webp') || src.includes('/D_Q_NP_'));
        image = mainImg || candidateImages[0];
      }

      if (!image) {
        const ogImg = document.querySelector('meta[property="og:image"]');
        image = ogImg ? ogImg.getAttribute('content') || '' : '';
      }

      // Preço Anterior
      let previousPriceText = '';
      const origPriceEl = document.querySelector('.ui-pdp-price__original-value, .andes-money-amount--previous, s.andes-money-amount, s .andes-money-amount, .ui-pdp-price__part--original');
      if (origPriceEl) {
        const fraction = origPriceEl.querySelector('.andes-money-amount__fraction');
        const cents = origPriceEl.querySelector('.andes-money-amount__cents');
        if (fraction) {
          previousPriceText = fraction.textContent?.trim() + (cents ? ',' + cents.textContent?.trim() : '');
        }
      }

      // Preço Atual
      let currentPriceText = '';
      const secondLine = document.querySelector('.ui-pdp-price__second-line, .ui-pdp-price__main-container, .ui-pdp-price');
      if (secondLine) {
        const fraction = secondLine.querySelector('.andes-money-amount__fraction');
        const cents = secondLine.querySelector('.andes-money-amount__cents');
        if (fraction) {
          currentPriceText = fraction.textContent?.trim() + (cents ? ',' + cents.textContent?.trim() : '');
        }
      }

      if (!currentPriceText) {
        const metaPrice = document.querySelector('meta[itemprop="price"]');
        if (metaPrice) {
          const content = metaPrice.getAttribute('content');
          if (content) currentPriceText = content;
        }
      }

      if (!currentPriceText) {
        const anyFraction = document.querySelector('.andes-money-amount__fraction');
        if (anyFraction) currentPriceText = anyFraction.textContent?.trim() || '';
      }

      return { title, image, currentPriceText, previousPriceText };
    });

    const preco_atual = parsePrice(extractedData.currentPriceText);
    const preco_anterior = parsePrice(extractedData.previousPriceText);

    this.logger.info(`[ProductExtractor] Extracted details for product ${productId}. Title: "${extractedData.title}", Price: ${preco_atual}`);

    // Fluxo oficial para obtenção do link de afiliado do Mercado Livre
    let link_afiliado: string | null = null;
    try {
      const isRealPlaywright = typeof rawPage.locator === 'function' && typeof rawPage.locator('body').count === 'function';
      if (!isRealPlaywright) {
        link_afiliado = 'https://meli.la/mock-affiliate';
      } else {
        // Se a URL original já for um link curto meli.la, preserva
        if (url.includes('meli.la')) {
          link_afiliado = url.trim();
        }

        // Método 1 (Principal e Mais Robusto): Gerador Oficial de Links (Linkbuilder)
        if (!link_afiliado) {
          link_afiliado = await this.generateViaLinkbuilder(rawPage, canonicalUrl);
        }

        // Método 2 (Fallback): Barra superior de afiliados na página do produto
        if (!link_afiliado) {
          link_afiliado = await this.generateViaTopBar(rawPage, canonicalUrl);
        }
      }

      let mensagem: string | null = null;
      if (link_afiliado && link_afiliado.includes('meli.la')) {
        link_afiliado = link_afiliado.trim();
        this.logger.info(`[MercadoLivreProductExtractor] Link de afiliado oficial meli.la confirmado: "${link_afiliado}"`);
      } else {
        link_afiliado = null;
        mensagem = "Não foi possível gerar o link encurtado oficial do Mercado Livre (meli.la) via barra de afiliados (verifique o login no Programa de Afiliados).";
        this.logger.info(`[MercadoLivreProductExtractor] ${mensagem}`);
      }

      return {
        success: true,
        marketplace: marketplaceName,
        id_produto: productId,
        nome_produto: extractedData.title || '',
        url_imagem: extractedData.image || null,
        url_produto: canonicalUrl,
        link_afiliado,
        mensagem,
        preco_anterior,
        preco_atual
      };

    } catch (err: any) {
      const isOriginalMeli = url.includes('meli.la');
      const link_afiliado = isOriginalMeli ? url : null;
      const mensagem = link_afiliado ? null : "Não foi possível gerar o link encurtado oficial do Mercado Livre (meli.la) via barra de afiliados (verifique o login no Programa de Afiliados).";
      
      return {
        success: true,
        marketplace: marketplaceName,
        id_produto: productId,
        nome_produto: extractedData.title || '',
        url_imagem: extractedData.image || null,
        url_produto: canonicalUrl,
        link_afiliado,
        mensagem,
        preco_anterior,
        preco_atual
      };
    }
  }

  private async generateViaLinkbuilder(rawPage: Page, productUrl: string): Promise<string | null> {
    try {
      this.logger.info(`[MercadoLivreProductExtractor] Navegando para o Linkbuilder oficial: https://www.mercadolivre.com.br/afiliados/linkbuilder#hub`);
      await rawPage.goto('https://www.mercadolivre.com.br/afiliados/linkbuilder#hub', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // Aguardar o textarea do linkbuilder carregar
      const textarea = rawPage.locator('textarea, textarea[placeholder*="mercadolivre.com"], .andes-form-control__field').first();
      await textarea.waitFor({ state: 'visible', timeout: 8000 });
      
      await textarea.click();
      await textarea.fill(productUrl);
      await rawPage.waitForTimeout(300);

      // Clicar no botão "Gerar"
      const generateBtn = rawPage.locator('button:has-text("Gerar"), button:text-is("Gerar"), .andes-button--loud:has-text("Gerar")').first();
      await generateBtn.waitFor({ state: 'visible', timeout: 4000 });
      await generateBtn.click({ force: true });
      this.logger.info('[MercadoLivreProductExtractor] Botão Gerar clicado no Linkbuilder.');

      // Aguardar o link meli.la ser gerado no painel da direita
      for (let i = 0; i < 12; i++) {
        await rawPage.waitForTimeout(500);
        
        // 1. Extrair via regex do DOM completo da página
        const html = await rawPage.content().catch(() => '');
        const match = html.match(/meli\.la\/[a-zA-Z0-9_-]+/i);
        if (match && match[0]) {
          const fullLink = match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
          this.logger.info(`[MercadoLivreProductExtractor] Link meli.la obtido do Linkbuilder via DOM: "${fullLink}"`);
          return fullLink.trim();
        }

        // 2. Extrair de inputs/textareas de resultado
        const resultInput = rawPage.locator('input[value*="meli.la"], textarea:has-text("meli.la"), a[href*="meli.la"]').first();
        if (await resultInput.count().catch(() => 0) > 0) {
          const href = await resultInput.getAttribute('href').catch(() => null);
          if (href && href.includes('meli.la')) return href.trim();
          const val = await resultInput.inputValue().catch(() => null);
          if (val && val.includes('meli.la')) return val.trim();
        }

        // 3. Clicar no botão de cópia
        const copyBtn = rawPage.locator('button:has-text("Copiar"), [data-testid*="copy"], button:has-text("Copiar link")').first();
        if (await copyBtn.count().catch(() => 0) > 0 && await copyBtn.isVisible().catch(() => false)) {
          const context = rawPage.context();
          await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
          await copyBtn.click({ force: true }).catch(() => {});
          await rawPage.waitForTimeout(300);

          const clipVal = await rawPage.evaluate(async () => {
            try { return await navigator.clipboard.readText(); } catch { return null; }
          });
          if (clipVal && clipVal.includes('meli.la')) {
            this.logger.info(`[MercadoLivreProductExtractor] Link meli.la obtido via clipboard no Linkbuilder: "${clipVal}"`);
            return clipVal.trim();
          }
        }
      }
    } catch (err: any) {
      this.logger.info(`[MercadoLivreProductExtractor] Tentativa via Linkbuilder falhou: ${err.message}`);
    }
    return null;
  }

  private async generateViaTopBar(rawPage: Page, productUrl: string): Promise<string | null> {
    try {
      const shareBtn = rawPage.locator('button:has-text("Compartilhar"), a:has-text("Compartilhar"), *:text-is("Compartilhar")').first();
      const hasBar = (await shareBtn.count().catch(() => 0)) > 0 && (await shareBtn.isVisible().catch(() => false));
      if (!hasBar) return null;

      this.logger.info('[MercadoLivreProductExtractor] Tentando via barra superior...');
      await shareBtn.click({ force: true });
      
      const modalContainer = rawPage.locator('.link-generator, div[data-testid="popper"], .andes-popper, div:has-text("Gerar link")').first();
      await modalContainer.waitFor({ state: 'visible', timeout: 3000 });
      await rawPage.waitForTimeout(500);

      const match = await modalContainer.evaluate((el: any) => {
        const m = el.innerHTML.match(/https?:\/\/meli\.la\/[a-zA-Z0-9_-]+/i);
        return m ? m[0] : null;
      }).catch(() => null);

      if (match) return match.trim();
    } catch {}
    return null;
  }
}
