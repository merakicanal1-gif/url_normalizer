import { IUrlResolver, ResolvedUrl } from '../../../domain/ports/IUrlResolver.js';
import { MarketplaceHostRegistry } from '../../../domain/services/MarketplaceHostRegistry.js';
import { followHttpRedirects } from './HttpResolverHelper.js';

export class MercadoLivreAffiliateResolver implements IUrlResolver {
  constructor(
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {}

  public canResolve(url: URL): boolean {
    return MarketplaceHostRegistry.isMercadoLivreAffiliate(url.hostname);
  }

  public async resolve(url: URL, _timeoutMs?: number): Promise<ResolvedUrl> {
    const start = performance.now();
    const urlString = url.toString();
    
    try {
      const res = await followHttpRedirects(url, 10, this.logger);
      const durationMs = Math.round(performance.now() - start);

      this.logger.info(`[MercadoLivreAffiliateResolver] Resolução HTTP concluída em ${durationMs}ms com ${res.redirects.length} redirecionamentos. ResolvedSuccess: ${res.resolvedSuccess}`);

      const outcome = res.resolvedSuccess ? 'RESOLVED' : 'CONTINUE';

      return {
        originalUrl: urlString,
        finalUrl: res.finalUrl,
        statusCode: res.statusCode,
        pageTitle: res.pageTitle,
        detectedChallenge: res.detectedChallenge,
        detectedCaptcha: res.detectedCaptcha,
        detectedConsent: res.detectedConsent,
        detectedLogin: res.detectedLogin,
        challengeType: res.challengeType,
        outcome,
        metadata: {
          resolver: 'MercadoLivreAffiliateResolver',
          strategy: 'http',
          redirectCount: res.redirects.length,
          durationMs,
          usedBrowser: false,
          usedHttp: true,
          fallbackOccurred: outcome === 'CONTINUE'
        }
      };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      this.logger.error(`[MercadoLivreAffiliateResolver] Erro na resolução HTTP. Delegando via CONTINUE...`, err);
      
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
          resolver: 'MercadoLivreAffiliateResolver',
          strategy: 'none',
          redirectCount: 0,
          durationMs,
          usedBrowser: false,
          usedHttp: true,
          fallbackOccurred: true,
          error: err.message
        }
      };
    }
  }
}
