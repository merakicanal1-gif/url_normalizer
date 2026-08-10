import { IUrlResolver, ResolvedUrl } from '../../domain/ports/IUrlResolver.js';
import { INavigatorPage } from '../../domain/ports/INavigator.js';
import { INormalizeTelemetry } from '../../domain/ports/INormalizeTelemetry.js';
import { NoOpNormalizeTelemetry } from '../../infrastructure/telemetry/NoOpNormalizeTelemetry.js';
import { MarketplaceHostRegistry } from '../../domain/services/MarketplaceHostRegistry.js';

export class CompositeUrlResolver implements IUrlResolver {
  private telemetry: INormalizeTelemetry;

  constructor(
    private resolvers: IUrlResolver[],
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void },
    telemetry?: INormalizeTelemetry
  ) {
    this.telemetry = telemetry || new NoOpNormalizeTelemetry();
  }

  public canResolve(_url: URL): boolean {
    return true; // O orquestrador central pode gerenciar qualquer URL
  }

  private getMarketplace(url: URL): string {
    if (MarketplaceHostRegistry.isAmazon(url.hostname) || MarketplaceHostRegistry.isAmazonAffiliate(url.hostname)) return 'amazon';
    if (MarketplaceHostRegistry.isMercadoLivre(url.hostname) || MarketplaceHostRegistry.isMercadoLivreAffiliate(url.hostname)) return 'mercadolivre';
    if (MarketplaceHostRegistry.isShopee(url.hostname) || MarketplaceHostRegistry.isShopeeAffiliate(url.hostname)) return 'shopee';
    return 'generic';
  }

  public async resolve(url: URL, timeoutMs?: number, profileId?: string, sessionPage?: INavigatorPage): Promise<ResolvedUrl> {
    const start = performance.now();
    let currentUrl = url;
    let fallbackOccurred = false;
    let fallbackCount = 0;

    for (const resolver of this.resolvers) {
      const canResolve = resolver.canResolve(currentUrl);
      console.log(`[CompositeUrlResolver] Resolver=${resolver.constructor.name}, canResolve=${canResolve}`);
      if (canResolve) {
        this.logger.info(`[CompositeUrlResolver] Tentando resolver URL via: ${resolver.constructor.name}`);
        this.telemetry.resolverStarted({ resolver: resolver.constructor.name, inputUrl: currentUrl.toString() });
        const resolverStart = performance.now();
        
        try {
          const result = await resolver.resolve(currentUrl, timeoutMs, profileId, sessionPage);
          const resolverDuration = Math.round(performance.now() - resolverStart);
          console.log(`[CompositeUrlResolver] Resolver=${resolver.constructor.name}, outcome=${result.outcome}, finalUrl="${result.finalUrl}"`);
          
          const outputUrlObj = new URL(result.finalUrl);
          const changedMarketplace = this.getMarketplace(currentUrl) !== this.getMarketplace(outputUrlObj);

          this.telemetry.resolverFinished({
            resolver: resolver.constructor.name,
            inputUrl: currentUrl.toString(),
            outputUrl: result.finalUrl,
            durationMs: resolverDuration,
            skipped: false,
            redirectsCount: result.metadata.redirectCount || 0,
            changedMarketplace
          });

          if (result.outcome === 'RESOLVED') {
            currentUrl = outputUrlObj;
            const durationMs = Math.round(performance.now() - start);
            result.metadata.durationMs = durationMs;
            result.metadata.fallbackOccurred = fallbackOccurred;
            
            this.logger.info(`[CompositeUrlResolver] URL resolvida com sucesso por ${resolver.constructor.name}. Strategy: ${result.metadata.strategy}. Redirects: ${result.metadata.redirectCount}`);
            return result;
          }
          
          if (result.outcome === 'STOP') {
            const durationMs = Math.round(performance.now() - start);
            result.metadata.durationMs = durationMs;
            result.metadata.fallbackOccurred = fallbackOccurred;
            
            this.logger.info(`[CompositeUrlResolver] Resolução interrompida por STOP em ${resolver.constructor.name}. Detalhes: ${result.challengeType || 'Desafio'}`);
            return result;
          }
          
          // Se for CONTINUE, marca fallbackOccurred e avança
          this.logger.info(`[CompositeUrlResolver] Resolvedor ${resolver.constructor.name} retornou CONTINUE. Continuando cadeia...`);
          fallbackOccurred = true;
          fallbackCount++;
        } catch (err: any) {
          const resolverDuration = Math.round(performance.now() - resolverStart);
          console.log(`[CompositeUrlResolver] Resolver=${resolver.constructor.name}, erro="${err.message}"`);
          this.logger.error(`[CompositeUrlResolver] Erro na execução de ${resolver.constructor.name}: ${err.message}`, err);
          
          this.telemetry.resolverFinished({
            resolver: resolver.constructor.name,
            inputUrl: currentUrl.toString(),
            outputUrl: currentUrl.toString(),
            durationMs: resolverDuration,
            skipped: false,
            redirectsCount: 0,
            changedMarketplace: false
          });

          fallbackOccurred = true;
          fallbackCount++;
        }
      } else {
        // Registrar resolvedor como skipped
        this.telemetry.resolverFinished({
          resolver: resolver.constructor.name,
          inputUrl: currentUrl.toString(),
          outputUrl: currentUrl.toString(),
          durationMs: 0,
          skipped: true,
          redirectsCount: 0,
          changedMarketplace: false
        });
      }
    }

    throw new Error(`Não foi possível resolver a URL ${url.toString()} utilizando nenhum resolvedor da cadeia.`);
  }
}

