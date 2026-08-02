import { IUrlResolver, ResolvedUrl } from '../../../domain/ports/IUrlResolver.js';
import { MarketplaceHostRegistry } from '../../../domain/services/MarketplaceHostRegistry.js';
import { INavigatorPage } from '../../../domain/ports/INavigator.js';

export class DirectMarketplaceResolver implements IUrlResolver {
  public canResolve(url: URL): boolean {
    const hostname = url.hostname;
    const isAffiliate = MarketplaceHostRegistry.isAmazonAffiliate(hostname) ||
                        MarketplaceHostRegistry.isMercadoLivreAffiliate(hostname) ||
                        MarketplaceHostRegistry.isShopeeAffiliate(hostname);
    return MarketplaceHostRegistry.isKnownMarketplace(hostname) && !isAffiliate;
  }

  public async resolve(url: URL, _timeoutMs?: number, profileId?: string, sessionPage?: INavigatorPage): Promise<ResolvedUrl> {
    const urlString = url.toString();
    return {
      originalUrl: urlString,
      finalUrl: urlString,
      statusCode: 200,
      pageTitle: '',
      detectedChallenge: false,
      detectedCaptcha: false,
      detectedConsent: false,
      detectedLogin: false,
      outcome: 'RESOLVED',
      metadata: {
        resolver: 'DirectMarketplaceResolver',
        strategy: 'none',
        redirectCount: 0,
        durationMs: 0,
        usedBrowser: false,
        usedHttp: false,
        fallbackOccurred: false
      }
    };
  }
}
