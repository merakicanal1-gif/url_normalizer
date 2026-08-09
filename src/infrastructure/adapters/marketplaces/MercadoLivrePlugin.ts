import { IMarketplacePlugin } from '../../../domain/ports/IMarketplacePlugin.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';
import { NormalizedProduct } from '../../../domain/models/Product.js';
import { ChallengeDetectedError } from '../../../domain/errors/ChallengeDetectedError.js';
import { MarketplaceUnavailableError, MarketplacePageType } from '../../../domain/errors/MarketplaceUnavailableError.js';
import { ProductNotFoundError } from '../../../domain/errors/ProductNotFoundError.js';
import { ProductUnavailableError } from '../../../domain/errors/ProductUnavailableError.js';
import { IPageClassifier } from '../../../domain/ports/IPageClassifier.js';
import { INavigationObserver } from '../../../domain/ports/INavigationObserver.js';
import { IProductPageValidator } from '../../../domain/ports/IProductPageValidator.js';
import { IProductExtractor } from '../../../domain/ports/IProductExtractor.js';
import { PageInspection } from '../../../domain/models/PageInspection.js';
import { IAuthenticationStrategy } from '../../../domain/ports/IAuthenticationStrategy.js';
import { MercadoLivreAuthenticationStrategy } from './MercadoLivreAuthenticationStrategy.js';
import { Page } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';

export enum NavigationState {
  INITIAL = 'INITIAL',
  OPEN_URL = 'OPEN_URL',
  WAIT_DOM = 'WAIT_DOM',
  WAIT_NETWORK = 'WAIT_NETWORK',
  INSPECT_PAGE = 'INSPECT_PAGE',
  DECIDE = 'DECIDE',
  CLICK_PRIMARY_CTA = 'CLICK_PRIMARY_CTA',
  WAIT_TRANSITION = 'WAIT_TRANSITION',
  VALIDATE_PRODUCT = 'VALIDATE_PRODUCT',
  PRODUCT_PAGE = 'PRODUCT_PAGE',
  EXTRACT_PRODUCT = 'EXTRACT_PRODUCT',
  FINISHED = 'FINISHED'
}

export class MercadoLivrePlugin implements IMarketplacePlugin {
  constructor(
    private readonly logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void },
    private readonly pageClassifier: IPageClassifier,
    private readonly navigationObserver: INavigationObserver,
    private readonly productPageValidator: IProductPageValidator,
    private readonly productExtractor: IProductExtractor
  ) {}

  public getAuthenticationStrategy(): IAuthenticationStrategy {
    return new MercadoLivreAuthenticationStrategy();
  }

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

  private getArtifactsDir(): string {
    const dir = process.env.ARTIFACTS_DIR || path.join(process.cwd(), 'data', 'screenshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private async takeScreenshot(rawPage: Page, stage: string, artifactsDir: string): Promise<string> {
    const screenshotPath = path.join(artifactsDir, `ml_stage_${stage}_${Date.now()}.png`);
    await rawPage.screenshot({ path: screenshotPath }).catch(() => {});
    return screenshotPath;
  }

  public async normalize(page: INavigatorPage, finalUrl: URL): Promise<NormalizedProduct> {
    const rawPage: Page = (page as any).getRawPage();
    let currentUrl = finalUrl;
    const artifactsDir = this.getArtifactsDir();
    const startTime = performance.now();

    let state = NavigationState.INITIAL;
    let attempts = 0;
    let transitions = 0;
    const maxTransitions = 50;
    let inspection: PageInspection | null = null;
    let pendingClick: Promise<void> | null = null;

    while (state !== NavigationState.FINISHED && transitions < maxTransitions) {
      transitions++;
      const stateStartTime = performance.now();
      this.logger.info(`[STATE_MACHINE] STATE=${state} URL="${currentUrl.toString()}" TRANSITIONS=${transitions}`);

      switch (state) {
        case NavigationState.INITIAL: {
          state = NavigationState.OPEN_URL;
          break;
        }

        case NavigationState.OPEN_URL: {
          this.logger.info(`[STATE_MACHINE] STATE=OPEN_URL URL="${currentUrl.toString()}" TIME_MS=${Math.round(performance.now() - stateStartTime)}`);
          if (rawPage.url() === 'about:blank' || currentUrl.hostname.includes('meli.la') || !rawPage.url().includes('mercadolivre.com')) {
            this.logger.info(`[STATE_MACHINE] Navegando explicitamente para ${currentUrl.toString()}...`);
            await rawPage.goto(currentUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
            currentUrl = new URL(rawPage.url());
            this.logger.info(`[STATE_MACHINE] URL após navegação: ${currentUrl.toString()}`);
          }
          state = NavigationState.WAIT_DOM;
          break;
        }

        case NavigationState.WAIT_DOM: {
          this.logger.info(`[STATE_MACHINE] STATE=WAIT_DOM URL="${currentUrl.toString()}"`);
          await rawPage.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
          state = NavigationState.INSPECT_PAGE;
          break;
        }

        case NavigationState.INSPECT_PAGE: {
          const screenshotPath = await this.takeScreenshot(rawPage, `inspect_step_${transitions}`, artifactsDir);
          inspection = await this.pageClassifier.classify(page, currentUrl.toString());
          
          this.logger.info(`[STATE_MACHINE] STATE=INSPECT_PAGE CLASSIFICATION=${inspection.pageType} SCREENSHOT="${screenshotPath}" TIME_MS=${Math.round(performance.now() - stateStartTime)}`);
          state = NavigationState.DECIDE;
          break;
        }

        case NavigationState.DECIDE: {
          if (!inspection) {
            throw new Error('Estado inconsistente: inspection não definida no DECIDE.');
          }

          if (inspection.pageType === 'WAF_PAGE' || inspection.pageType === 'CAPTCHA_PAGE' || inspection.pageType === 'LOGIN_PAGE') {
            const redirectUrl = this.getRedirectUrlFromParams(rawPage.url());
            if (redirectUrl && redirectUrl !== rawPage.url()) {
              attempts++;
              if (attempts <= 2) {
                this.logger.info(`[STATE_MACHINE] Bloqueio ou tela de login detectada (${inspection.pageType}). URL de redirecionamento encontrada: "${redirectUrl}". Tentativa ${attempts}/2...`);
                await rawPage.goto(redirectUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch((e) => {
                  this.logger.error(`[STATE_MACHINE] Erro ao navegar para URL de redirecionamento: ${e.message}`);
                });
                currentUrl = new URL(rawPage.url());
                state = NavigationState.WAIT_DOM;
                break;
              }

              // Extração resiliente direta dos parâmetros de redirecionamento
              const mlbMatch = /(MLB[U]?-?\d+)/i.exec(redirectUrl);
              if (mlbMatch) {
                const productId = mlbMatch[1].replace('-', '').toUpperCase();
                const slugMatch = /MLB-?\d+-([a-zA-Z0-9_-]+)/i.exec(redirectUrl);
                const titleFromSlug = slugMatch ? slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Produto Mercado Livre';
                const cleanProductUrl = redirectUrl.split('?')[0].split('#')[0];

                this.logger.info(`[STATE_MACHINE] Extração resiliente via redirectUrl: ID=${productId}, Título="${titleFromSlug}"`);
                return {
                  success: true,
                  is_produto: true,
                  tipo_pagina: 'produto',
                  marketplace: this.getMarketplaceName(),
                  id_produto: productId,
                  nome_produto: titleFromSlug,
                  url_imagem: null,
                  url_produto: cleanProductUrl,
                  link_afiliado: finalUrl.toString().includes('meli.la') ? finalUrl.toString() : cleanProductUrl,
                  preco_anterior: null,
                  preco_atual: null
                };
              }
            }
          }

          if (inspection.pageType === 'WAF_PAGE') {
            throw new ChallengeDetectedError(`Bloqueio de WAF detectado: ${inspection.evidences.join(', ')}`, 'WAF');
          }
          if (inspection.pageType === 'CAPTCHA_PAGE') {
            throw new ChallengeDetectedError(`Bloqueio de CAPTCHA detectado: ${inspection.evidences.join(', ')}`, 'CAPTCHA');
          }
          if (inspection.pageType === 'LOGIN_PAGE') {
            throw new ChallengeDetectedError(`Página de login exigida: ${inspection.evidences.join(', ')}`, 'LOGIN');
          }
          if (inspection.pageType === 'ERROR_PAGE') {
            throw new ProductUnavailableError();
          }

          if (inspection.pageType === 'PRODUCT_PAGE') {
            state = NavigationState.VALIDATE_PRODUCT;
          } else if (inspection.pageType === 'AFFILIATE_LANDING') {
            state = NavigationState.CLICK_PRIMARY_CTA;
          } else {
            if (attempts === 0) {
              attempts++;
              this.logger.info(`[STATE_MACHINE] STATE=DECIDE CLASSIFICATION=UNKNOWN. Aguardando estabilização secundária...`);
              await rawPage.waitForTimeout(1500);
              state = NavigationState.INSPECT_PAGE;
            } else {
              if (inspection.hasMLB) {
                this.logger.info(`[STATE_MACHINE] STATE=DECIDE CLASSIFICATION=UNKNOWN com MLB. Forçando validação.`);
                state = NavigationState.VALIDATE_PRODUCT;
              } else {
                this.logger.info(`[STATE_MACHINE] Página não é um produto individual. Retornando objeto estruturado.`);
                return {
                  success: true,
                  is_produto: false,
                  tipo_pagina: 'nao_produto',
                  marketplace: this.getMarketplaceName(),
                  id_produto: null,
                  nome_produto: await rawPage.title().catch(() => null),
                  url_imagem: null,
                  url_produto: rawPage.url(),
                  link_afiliado: null,
                  preco_anterior: null,
                  preco_atual: null,
                  mensagem: 'URL válida, porém direciona para uma página inicial, lista, busca ou perfil social (não é um produto individual).'
                };
              }
            }
          }
          break;
        }

        case NavigationState.CLICK_PRIMARY_CTA: {
          const buttonLocator = rawPage.locator('a, button, [role="button"], .andes-button').filter({
            hasText: /ir (para )?(o )?produto|al producto|ver produto|comprar agora|acessar produto/i
          });

          this.logger.info(`[STATE_MACHINE] STATE=CLICK_PRIMARY_CTA Aguardando CTA principal ou link de produto...`);
          
          try {
            // Prioridade 1: Clicar no botão CTA na página com emulação de cursor humano
            if (await buttonLocator.count().catch(() => 0) > 0 && await buttonLocator.first().isVisible().catch(() => false)) {
              this.logger.info(`[STATE_MACHINE] STATE=CLICK_PRIMARY_CTA Clicando no botão CTA visível.`);
              const btn = buttonLocator.first();
              await btn.hover().catch(() => {});
              await rawPage.waitForTimeout(250);
              await btn.click({ delay: 120 }).catch(() => {});
              await rawPage.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
              await rawPage.waitForTimeout(1500);
              currentUrl = new URL(rawPage.url());
              state = NavigationState.INSPECT_PAGE;
              break;
            }

            // Prioridade 2: Obter link direto para o produto destacado na landing page
            const directProductHref = await rawPage.evaluate(() => {
              const elements = Array.from(document.querySelectorAll('a'));
              const textRegex = /ir (para )?(o )?produto|al producto|ver produto|acessar produto/i;
              for (const a of elements) {
                if (textRegex.test(a.textContent?.trim() || '') && a.href) {
                  return a.href;
                }
              }
              const mlbA = document.querySelector('a[href*="produto.mercadolivre.com.br/MLB"], a[href*="/p/MLB"], a[href*="/up/MLB"]') as HTMLAnchorElement | null;
              return mlbA ? mlbA.href : null;
            });

            if (directProductHref && directProductHref.startsWith('http')) {
              this.logger.info(`[STATE_MACHINE] STATE=CLICK_PRIMARY_CTA Link direto encontrado: "${directProductHref}". Navegando...`);
              await rawPage.goto(directProductHref, { timeout: 15000 }).catch(() => {});
              currentUrl = new URL(rawPage.url());
              state = NavigationState.WAIT_DOM;
              break;
            }
          } catch (e: any) {
            this.logger.info(`[STATE_MACHINE] STATE=CLICK_PRIMARY_CTA CTA não encontrado: ${e.message}`);
            if (inspection?.hasMLB) {
              state = NavigationState.VALIDATE_PRODUCT;
            } else {
              return {
                success: true,
                is_produto: false,
                tipo_pagina: 'nao_produto',
                marketplace: this.getMarketplaceName(),
                id_produto: null,
                nome_produto: await rawPage.title().catch(() => null),
                url_imagem: null,
                url_produto: rawPage.url(),
                link_afiliado: null,
                preco_anterior: null,
                preco_atual: null,
                mensagem: 'URL válida, porém direciona para uma página inicial, lista, busca ou perfil social (não é um produto individual).'
              };
            }
          }
          break;
        }

        case NavigationState.VALIDATE_PRODUCT: {
          this.logger.info(`[STATE_MACHINE] STATE=VALIDATE_PRODUCT Avaliando confiança estrutural da PDP.`);
          if (!inspection) {
            throw new Error('Estado inconsistente: inspection não definida no VALIDATE_PRODUCT.');
          }

          const validation = await this.productPageValidator.validate(inspection);
          
          this.logger.info(`[STATE_MACHINE] STATE=VALIDATE_PRODUCT VALID=${validation.isValid} CONFIDENCE=${validation.confidence} EVIDENCES=[${validation.evidences.join(', ')}]`);

          if (validation.isValid) {
            state = NavigationState.PRODUCT_PAGE;
          } else {
            const reClass = await this.pageClassifier.classify(page, currentUrl.toString());
            const finalValidation = await this.productPageValidator.validate(reClass);

            if (finalValidation.isValid) {
              state = NavigationState.PRODUCT_PAGE;
            } else {
              return {
                success: true,
                is_produto: false,
                tipo_pagina: 'nao_produto',
                marketplace: this.getMarketplaceName(),
                id_produto: null,
                nome_produto: await rawPage.title().catch(() => null),
                url_imagem: null,
                url_produto: rawPage.url(),
                link_afiliado: null,
                preco_anterior: null,
                preco_atual: null,
                mensagem: 'URL válida, porém direciona para uma página inicial, lista, busca ou perfil social (não é um produto individual).'
              };
            }
          }
          break;
        }

        case NavigationState.PRODUCT_PAGE: {
          this.logger.info(`[STATE_MACHINE] STATE=PRODUCT_PAGE Confirmado.`);
          state = NavigationState.EXTRACT_PRODUCT;
          break;
        }

        case NavigationState.EXTRACT_PRODUCT: {
          this.logger.info(`[STATE_MACHINE] STATE=EXTRACT_PRODUCT Extraindo dados.`);
          
          const extracted = await this.productExtractor.extract(page, currentUrl.toString(), this.getMarketplaceName());
          
          (this as any)._normalizedProduct = extracted;
          state = NavigationState.FINISHED;
          break;
        }

        default:
          throw new Error(`Estado desconhecido na máquina de estados: ${state}`);
      }
    }

    if (state !== NavigationState.FINISHED) {
      throw new Error(`Máquina de estados falhou em concluir após ${transitions} transições. Estado final: ${state}`);
    }

    const duration = performance.now() - startTime;
    this.logger.info(`[STATE_MACHINE] Normalização concluída em ${duration.toFixed(2)}ms.`);
    return (this as any)._normalizedProduct;
  }

  private getRedirectUrlFromParams(urlStr: string): string | null {
    try {
      const urlObj = new URL(urlStr);
      const paramsToCheck = ['go', 'redirect', 'redirect_url', 'url'];
      for (const param of paramsToCheck) {
        const value = urlObj.searchParams.get(param);
        if (value) {
          const decoded = decodeURIComponent(value);
          if (decoded.startsWith('http') && (decoded.includes('mercadolivre.com') || decoded.includes('mercadolibre.com') || decoded.includes('meli.la'))) {
            try {
              const targetUrlObj = new URL(decoded);
              // Remove query parameters and hashes to avoid tracking blocks/redirects
              return targetUrlObj.origin + targetUrlObj.pathname;
            } catch (e) {
              return decoded;
            }
          }
        }
      }
    } catch (e) {}
    return null;
  }
}
