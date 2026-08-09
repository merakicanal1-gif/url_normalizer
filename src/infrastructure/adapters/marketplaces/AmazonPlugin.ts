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
      throw new ProductUnavailableError();
    }

    // Se for PRODUCT_PAGE ou UNKNOWN, tenta extrair
    const asinMatch = /\/(dp|gp\/product)\/([A-Z0-9]{10})/i.exec(urlStr);
    if (!asinMatch) {
      throw new ProductNotFoundError();
    }

    const productId = asinMatch[2].toUpperCase();
    const canonicalUrl = `https://${finalUrl.hostname}/dp/${productId}`;

    const extractedData = await page.evaluate<{ title: string; image: string; currentPriceText: string; previousPriceText: string }>(() => {
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

      // Preço Atual
      let currentPriceText = '';
      const priceSelectors = [
        '.priceToPay .a-offscreen',
        '.apexPriceToPay .a-offscreen',
        '#price_inside_buybox',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.a-price .a-offscreen'
      ];
      for (const selector of priceSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent?.trim()) {
          currentPriceText = el.textContent.trim();
          break;
        }
      }
      if (!currentPriceText) {
        const wholeEl = document.querySelector('.priceToPay .a-price-whole');
        const fractionEl = document.querySelector('.priceToPay .a-price-fraction');
        if (wholeEl) {
          currentPriceText = wholeEl.textContent?.trim() + (fractionEl ? ',' + fractionEl.textContent?.trim() : '');
        }
      }

      // Preço Anterior
      let previousPriceText = '';
      const prevPriceSelectors = [
        '.basisPrice .a-offscreen',
        '.a-text-price[data-a-strike="true"] .a-offscreen',
        '.a-text-price[data-a-strike="true"]',
        '#listPrice'
      ];
      for (const selector of prevPriceSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent?.trim()) {
          previousPriceText = el.textContent.trim();
          break;
        }
      }

      return { title: titleText, image, currentPriceText, previousPriceText };
    });

    const preco_atual = parsePrice(extractedData.currentPriceText);
    const preco_anterior = parsePrice(extractedData.previousPriceText);

    // Tentar obter o link de associado oficial via SiteStripe se disponível
    if (!extractedData.title) {
      throw new ProductUnavailableError();
    }

    let link_afiliado: string | null = null;
    let generatedLink: string | null = null;
    const tag = process.env.AMAZON_AFFILIATE_TAG || '17072212-20';
    const fallbackAffiliateLink = `${canonicalUrl}?tag=${tag}`;

    try {
      const rawPage = (page as any).getRawPage ? (page as any).getRawPage() : page;
      const isRealPlaywright = typeof rawPage.locator === 'function' && typeof rawPage.locator('body').count === 'function';
      if (!isRealPlaywright) {
        link_afiliado = fallbackAffiliateLink;
      } else {
        const stripeSelector = '#amzn-ss-wrap, #amzn-assoc-stripe, .amzn-ss-wrap';
        
        // Checar se o elemento do SiteStripe existe na página
        const stripeLocator = rawPage.locator(stripeSelector).first();
        const hasStripe = (await stripeLocator.count().catch(() => 0) > 0) && (await stripeLocator.isVisible().catch(() => false));
        
        if (hasStripe) {
          this.logger.info('[AmazonPlugin] SiteStripe detectado. Tentando obter link de afiliado curto oficial...');
          
          const context = rawPage.context();
          await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

          // 1. Instalar spy de clipboard no browser para capturar o link curto instantaneamente
          await rawPage.evaluate(() => {
            (window as any).__lastCopiedText = null;
            if (navigator.clipboard) {
              const originalWrite = navigator.clipboard.writeText ? navigator.clipboard.writeText.bind(navigator.clipboard) : null;
              navigator.clipboard.writeText = async (text: string) => {
                (window as any).__lastCopiedText = text;
                if (originalWrite) {
                  return originalWrite(text).catch(() => {});
                }
              };
            }
          }).catch(() => {});

          // 2. Clicar no botão "Obter link" do SiteStripe
          const getLinkBtn = rawPage.locator('#amzn-ss-get-link-button, #amzn-ss-text-link button, button:has-text("Obter link"), #amzn-ss-text-link').first();
          if (await getLinkBtn.count().catch(() => 0) > 0) {
            await getLinkBtn.click({ force: true, timeout: 3000 }).catch(() => {});
            
            // 3. Aguardar o botão "Copiar link de associado" ficar visível no popover
            const copyBtn = rawPage.locator('#amzn-ss-copy-affiliate-link-btn-announce, #amzn-ss-copy-affiliate-link-btn button, button:has-text("Copiar link de associado"), #amzn-ss-copy-affiliate-link-btn').first();
            
            try {
              await copyBtn.waitFor({ state: 'visible', timeout: 4000 });
              await copyBtn.click({ force: true, timeout: 2000 });
            } catch (err) {
              this.logger.info('[AmazonPlugin] Botão de cópia não apareceu no tempo limite.');
            }

            // 4. Ler o link curto capturado pelo spy ou pelo clipboard
            for (let i = 0; i < 8; i++) {
              await rawPage.waitForTimeout(250);
              const spyVal = await rawPage.evaluate(() => (window as any).__lastCopiedText);
              if (spyVal && typeof spyVal === 'string' && (spyVal.includes('amzn.to') || spyVal.includes('link.amazon') || spyVal.includes('amazon.com'))) {
                generatedLink = spyVal.trim();
                break;
              }
              const clipVal = await rawPage.evaluate(async () => {
                try {
                  return await navigator.clipboard.readText();
                } catch {
                  return null;
                }
              });
              if (clipVal && (clipVal.includes('amzn.to') || clipVal.includes('link.amazon') || clipVal.includes('amazon.com'))) {
                generatedLink = clipVal.trim();
                break;
              }
            }

            // 5. Fallback adicional de leitura de inputs/textareas do popover
            if (!generatedLink) {
              generatedLink = await rawPage.evaluate(() => {
                const popover = document.querySelector('#a-popover-content-3, .amzn-ss-popupbox, .a-popover-inner, #amzn-ss-text-popover');
                if (!popover) return null;
                const match = popover.innerHTML.match(/https?:\/\/(amzn\.to\/[a-zA-Z0-9_-]+|link\.amazon\/[a-zA-Z0-9_-]+)/);
                return match ? match[0] : null;
              }).catch(() => null);
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.info(`[AmazonPlugin] Erro durante interação com SiteStripe: ${err.message}`);
    }

    let mensagem: string | null = null;
    if (generatedLink && (generatedLink.includes('link.amazon') || generatedLink.includes('amzn.to'))) {
      link_afiliado = generatedLink.trim();
      this.logger.info(`[AmazonPlugin] Link de associado encurtado oficial obtido via SiteStripe: "${link_afiliado}"`);
    } else {
      link_afiliado = null;
      mensagem = "Não foi possível gerar o link encurtado oficial da Amazon via SiteStripe (verifique o login no Programa de Associados).";
      this.logger.info(`[AmazonPlugin] ${mensagem}`);
    }

    console.log(`[AmazonPlugin] [extract/normalize] Extração concluída. ASIN="${productId}", Link Afiliado Oficial="${link_afiliado}"`);
    return {
      success: true,
      marketplace: this.getMarketplaceName(),
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
