import { IUrlResolver, ResolvedUrl } from '../../../domain/ports/IUrlResolver.js';
import { IBrowserSessionFactory } from '../../../domain/ports/IBrowserSessionFactory.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';
import { INormalizeTelemetry } from '../../../domain/ports/INormalizeTelemetry.js';
import { NoOpNormalizeTelemetry } from '../../telemetry/NoOpNormalizeTelemetry.js';
import { RedirectReason } from '../../../domain/models/trace/RedirectReason.js';

export class PlaywrightRedirectResolver implements IUrlResolver {
  private telemetry: INormalizeTelemetry;

  constructor(
    private sessionFactory: IBrowserSessionFactory,
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void },
    telemetry?: INormalizeTelemetry
  ) {
    this.telemetry = telemetry || new NoOpNormalizeTelemetry();
  }

  public canResolve(_url: URL): boolean {
    return true; // Fallback final universal
  }

  public async resolve(url: URL, timeoutMs?: number, profileId?: string, sessionPage?: INavigatorPage): Promise<ResolvedUrl> {
    const start = performance.now();
    const urlString = url.toString();
    this.logger.info(`[PlaywrightRedirectResolver] Tentando resolver via Playwright: ${urlString} (sessionPage reusado: ${!!sessionPage})`);

    let pageToUse = sessionPage;
    let sessionToDispose: any = null;

    if (pageToUse) {
      this.telemetry.browserReused({ runtime: 'worker', browserMode: 'headless' });
    } else {
      this.telemetry.browserCreated({ runtime: 'worker', browserMode: 'headless' });
      this.logger.info(`[PlaywrightRedirectResolver] Nenhum sessionPage ativo fornecido. Criando nova sessão worker 'generic'.`);
      const session = await this.sessionFactory.createSession('generic', profileId);
      pageToUse = session.page;
      sessionToDispose = session;
    }

    const rawPage = (pageToUse as any).getRawPage?.();
    let redirectCount = 0;

    const onRequest = (request: any) => {
      const redirectedFrom = request.redirectedFrom();
      if (redirectedFrom) {
        redirectCount++;
        const response = redirectedFrom.response();
        let reason: RedirectReason = 'UNKNOWN';
        if (response) {
          const status = response.status();
          if (status === 301) reason = 'HTTP_301';
          else if (status === 302) reason = 'HTTP_302';
        }
        this.telemetry.redirect({
          resolver: 'PlaywrightRedirectResolver',
          fromUrl: redirectedFrom.url(),
          toUrl: request.url(),
          reason
        });
      }
    };

    if (rawPage) {
      rawPage.on('request', onRequest);
    }

    try {
      const finalUrlStr = await pageToUse.goto(urlString, timeoutMs);
      const durationMs = Math.round(performance.now() - start);

      this.logger.info(`[PlaywrightRedirectResolver] Concluído via Playwright em ${durationMs}ms. URL final: ${finalUrlStr}`);

      return {
        originalUrl: urlString,
        finalUrl: finalUrlStr,
        statusCode: 200,
        pageTitle: '',
        detectedChallenge: false,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        outcome: 'RESOLVED',
        metadata: {
          resolver: 'PlaywrightRedirectResolver',
          strategy: 'browser',
          redirectCount,
          durationMs,
          usedBrowser: true,
          usedHttp: false,
          fallbackOccurred: false
        }
      };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      this.logger.error(`[PlaywrightRedirectResolver] Erro na resolução via Playwright: ${err.message}`, err);
      
      return {
        originalUrl: urlString,
        finalUrl: urlString,
        statusCode: null,
        pageTitle: '',
        detectedChallenge: true,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        challengeType: 'UNKNOWN',
        outcome: 'CONTINUE',
        metadata: {
          resolver: 'PlaywrightRedirectResolver',
          strategy: 'none',
          redirectCount: 0,
          durationMs,
          usedBrowser: true,
          usedHttp: false,
          fallbackOccurred: true,
          error: err.message
        }
      };
    } finally {
      if (rawPage) {
        rawPage.off('request', onRequest);
      }
      if (sessionToDispose) {
        await sessionToDispose.dispose().catch(() => {});
      }
    }
  }
}

