import { IUrlResolver, ResolvedUrl } from '../../../domain/ports/IUrlResolver.js';
import { MarketplaceHostRegistry } from '../../../domain/services/MarketplaceHostRegistry.js';
import { followHttpRedirects } from './HttpResolverHelper.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';

export class AmazonAffiliateResolver implements IUrlResolver {
  constructor(
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {}

  public canResolve(url: URL): boolean {
    return MarketplaceHostRegistry.isAmazonAffiliate(url.hostname);
  }

  public async resolve(url: URL, _timeoutMs?: number, profileId?: string, sessionPage?: INavigatorPage): Promise<ResolvedUrl> {
    const start = performance.now();
    const urlString = url.toString();
    
    try {
      const res = await followHttpRedirects(url, 10, this.logger);
      const durationMs = Math.round(performance.now() - start);

      this.logger.info(`[AmazonAffiliateResolver] Resolução HTTP concluída em ${durationMs}ms com ${res.redirects.length} redirecionamentos. ResolvedSuccess: ${res.resolvedSuccess}`);

      // Retorna RESOLVED apenas se resolvedSuccess for verdadeiro (evidência objetiva)
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
          resolver: 'AmazonAffiliateResolver',
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
      this.logger.error(`[AmazonAffiliateResolver] Erro na resolução HTTP. Delegando via CONTINUE...`, err);
      
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
          resolver: 'AmazonAffiliateResolver',
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
