import { IUrlResolver, ResolvedUrl } from '../../../domain/ports/IUrlResolver.js';
import { IBrowserSessionFactory } from '../../../domain/ports/IBrowserSessionFactory.js';

export class PlaywrightRedirectResolver implements IUrlResolver {
  constructor(
    private sessionFactory: IBrowserSessionFactory,
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {}

  public canResolve(_url: URL): boolean {
    return true; // Fallback final universal
  }

  public async resolve(url: URL, timeoutMs?: number, profileId?: string): Promise<ResolvedUrl> {
    const start = performance.now();
    const urlString = url.toString();
    this.logger.info(`[PlaywrightRedirectResolver] Tentando resolver via Playwright: ${urlString}`);

    // Solicita uma sessão worker genérica
    const session = await this.sessionFactory.createSession('generic', profileId);

    try {
      const finalUrlStr = await session.page.goto(urlString, timeoutMs);
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
          redirectCount: 1,
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
      await session.dispose().catch(() => {});
    }
  }
}
