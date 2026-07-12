import { IUrlResolver, ResolvedUrl } from '../../domain/ports/IUrlResolver.js';
import { INavigatorPage } from '../../domain/ports/INavigator.js';

export class CompositeUrlResolver implements IUrlResolver {
  constructor(
    private resolvers: IUrlResolver[],
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {}

  public canResolve(_url: URL): boolean {
    return true; // O orquestrador central pode gerenciar qualquer URL
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
        
        try {
          const result = await resolver.resolve(currentUrl, timeoutMs, profileId, sessionPage);
          console.log(`[CompositeUrlResolver] Resolver=${resolver.constructor.name}, outcome=${result.outcome}, finalUrl="${result.finalUrl}"`);
          
          if (result.outcome === 'RESOLVED') {
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
          console.log(`[CompositeUrlResolver] Resolver=${resolver.constructor.name}, erro="${err.message}"`);
          this.logger.error(`[CompositeUrlResolver] Erro na execução de ${resolver.constructor.name}: ${err.message}`, err);
          fallbackOccurred = true;
          fallbackCount++;
        }
      }
    }

    throw new Error(`Não foi possível resolver a URL ${url.toString()} utilizando nenhum resolvedor da cadeia.`);
  }
}
