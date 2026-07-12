import { IMarketplacePlugin } from '../../../domain/ports/IMarketplacePlugin.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';
import { NormalizedProduct } from '../../../domain/models/Product.js';
import { ChallengeDetectedError } from '../../../domain/errors/ChallengeDetectedError.js';
import { MarketplaceUnavailableError, MarketplacePageType } from '../../../domain/errors/MarketplaceUnavailableError.js';
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
          state = NavigationState.WAIT_DOM;
          break;
        }

        case NavigationState.WAIT_DOM: {
          this.logger.info(`[STATE_MACHINE] STATE=WAIT_DOM URL="${currentUrl.toString()}"`);
          await rawPage.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch((e) => {
            this.logger.info(`[STATE_MACHINE] Timeout ou aviso ao esperar domcontentloaded: ${e.message}`);
          });
          state = NavigationState.WAIT_NETWORK;
          break;
        }

        case NavigationState.WAIT_NETWORK: {
          this.logger.info(`[STATE_MACHINE] STATE=WAIT_NETWORK URL="${currentUrl.toString()}"`);
          await rawPage.waitForLoadState('networkidle', { timeout: 3000 }).catch((e) => {
            this.logger.info(`[STATE_MACHINE] Timeout ou aviso ao esperar networkidle: ${e.message}`);
          });
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
            const finalScreenshot = await this.takeScreenshot(rawPage, 'error', artifactsDir);
            throw new MarketplaceUnavailableError(
              'O marketplace retornou uma página de erro.',
              'ERROR_PAGE',
              inspection.title || await rawPage.title(),
              currentUrl.toString(),
              this.getMarketplaceName(),
              inspection.evidences.join(', '),
              finalScreenshot,
              (await rawPage.content()).substring(0, 500)
            );
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
                const finalScreenshot = await this.takeScreenshot(rawPage, 'unknown_failure', artifactsDir);
                throw new MarketplaceUnavailableError(
                  'Não foi possível classificar a página após estabilização.',
                  'ERROR_PAGE',
                  inspection.title || await rawPage.title(),
                  currentUrl.toString(),
                  this.getMarketplaceName(),
                  inspection.evidences.join(', '),
                  finalScreenshot,
                  (await rawPage.content()).substring(0, 500)
                );
              }
            }
          }
          break;
        }

        case NavigationState.CLICK_PRIMARY_CTA: {
          const buttonLocator = rawPage.locator('a, button, [role="button"]').filter({
            hasText: /ir (para (o )?produto|al producto)/i
          });

          this.logger.info(`[STATE_MACHINE] STATE=CLICK_PRIMARY_CTA Aguardando CTA principal ficar visível...`);
          
          try {
            await buttonLocator.first().waitFor({ state: 'visible', timeout: 5000 });
            await this.takeScreenshot(rawPage, 'before_click', artifactsDir);
            
            this.logger.info(`[STATE_MACHINE] STATE=CLICK_PRIMARY_CTA Clicando no CTA.`);
            pendingClick = buttonLocator.first().click({ timeout: 5000 });
            state = NavigationState.WAIT_TRANSITION;
          } catch (e: any) {
            this.logger.error(`[STATE_MACHINE] STATE=CLICK_PRIMARY_CTA Falha ao clicar no CTA: ${e.message}`);
            if (inspection?.hasMLB) {
              state = NavigationState.VALIDATE_PRODUCT;
            } else {
              throw e;
            }
          }
          break;
        }

        case NavigationState.WAIT_TRANSITION: {
          this.logger.info(`[STATE_MACHINE] STATE=WAIT_TRANSITION Observando transição pós-clique...`);
          
          const result = await this.navigationObserver.waitForTransition(page, pendingClick);
          pendingClick = null;
          
          this.logger.info(`[STATE_MACHINE] STATE=WAIT_TRANSITION Vencedor="${result}"`);
          currentUrl = new URL(rawPage.url());
          state = NavigationState.WAIT_DOM;
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
              const finalScreenshot = await this.takeScreenshot(rawPage, 'invalid_destination', artifactsDir);
              throw new MarketplaceUnavailableError(
                `Confiança da página de produto insuficiente (${finalValidation.confidence}/70).`,
                'ERROR_PAGE',
                reClass.title || await rawPage.title(),
                currentUrl.toString(),
                this.getMarketplaceName(),
                finalValidation.evidences.join(', '),
                finalScreenshot,
                (await rawPage.content()).substring(0, 500)
              );
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
          
          (this as any)._normalizedProduct = await this.productExtractor.extract(page, currentUrl.toString(), this.getMarketplaceName());
          
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
}
