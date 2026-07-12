import * as crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { IUrlResolver } from '../../domain/ports/IUrlResolver.js';
import { MarketplaceRegistry } from '../registry/MarketplaceRegistry.js';
import { NormalizedProduct } from '../../domain/models/Product.js';
import { IBrowserSessionFactory } from '../../domain/ports/IBrowserSessionFactory.js';
import { IApplicationEventBus } from '../../domain/ports/IApplicationEventBus.js';
import { MarketplaceHostRegistry } from '../../domain/services/MarketplaceHostRegistry.js';
import { IAuthenticationSessionManager } from '../../domain/ports/IAuthenticationSessionManager.js';
import { ChallengeDetectedError } from '../../domain/errors/ChallengeDetectedError.js';
import { SessionStatus } from '../../domain/models/AuthenticationSessionStatus.js';

export class NormalizeService {
  constructor(
    private urlResolver: IUrlResolver,
    private registry: MarketplaceRegistry,
    private sessionFactory: IBrowserSessionFactory,
    private eventBus: IApplicationEventBus,
    private sessionManager?: IAuthenticationSessionManager,
    private defaultTimeoutMs: number = 30000
  ) {}

  public async normalize(
    originalUrlString: string,
    profileId?: string,
    traceId?: string | null,
    requestId?: string | null
  ): Promise<NormalizedProduct> {
    console.log(`----------------------------------\n[NormalizeService] originalUrl="${originalUrlString}" profileId="${profileId || 'undefined'}"\n----------------------------------`);

    // 1. Resolver redirecionamentos iniciais via CompositeUrlResolver
    const originalUrl = new URL(originalUrlString);
    const resolved = await this.urlResolver.resolve(originalUrl, this.defaultTimeoutMs, profileId);
    const finalUrl = new URL(resolved.finalUrl);
    console.log(`[NormalizeService] resolvedUrl="${resolved.finalUrl}" resolver="${resolved.metadata.resolver}"`);

    // Identificar o marketplace inicial para carregar o perfil de autenticação correto
    let initialMarketplace = 'generic';
    if (MarketplaceHostRegistry.isAmazon(finalUrl.hostname)) {
      initialMarketplace = 'amazon';
    } else if (MarketplaceHostRegistry.isMercadoLivre(finalUrl.hostname)) {
      initialMarketplace = 'mercadolivre';
    } else if (MarketplaceHostRegistry.isShopee(finalUrl.hostname)) {
      initialMarketplace = 'shopee';
    }

    // Tentar resolver plugin inicial estimado
    let pluginInicialInfo = 'fallback/desconhecido';
    try {
      const pluginInicial = this.registry.resolve(finalUrl);
      pluginInicialInfo = pluginInicial.constructor.name;
    } catch (e) {}

    console.log(`[NormalizeService] pluginInicial="${pluginInicialInfo}" marketplaceInicial="${initialMarketplace}"`);

    // 3. Publicar evento NORMALIZATION_STARTED
    this.eventBus.publish({
      eventId: crypto.randomUUID(),
      event: 'NORMALIZATION_STARTED',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'NormalizeService',
      traceId: traceId || null,
      requestId: requestId || null,
      sessionId: null,
      marketplace: initialMarketplace,
      profileId: profileId || null,
      payload: {
        url: originalUrlString,
        marketplace: initialMarketplace,
        profileId
      }
    });

    // 4. Solicitar sessão worker ao PlaywrightBrowserSessionFactory
    const session = await this.sessionFactory.createSession(initialMarketplace, profileId);

    if (profileId) {
      this.eventBus.publish({
        eventId: crypto.randomUUID(),
        event: 'PROFILE_USED',
        version: 1,
        occurredAt: new Date().toISOString(),
        source: 'NormalizeService',
        traceId: traceId || null,
        requestId: requestId || null,
        sessionId: null,
        marketplace: initialMarketplace,
        profileId,
        payload: {
          marketplace: initialMarketplace,
          profileId,
          success: true
        }
      });
    }

    const startTime = performance.now();
    try {
      // 5. Navegar para a URL resolvida
      await session.page.goto(finalUrl.toString(), this.defaultTimeoutMs);

      // Obter a URL real final da navegação na página (após redirecionamentos via JS/Client)
      const actualFinalUrlStr = session.page.getFinalUrl();
      const actualFinalUrl = new URL(actualFinalUrlStr);

      const pageUrlStr = (session.page as any).page?.url?.() || (session.page as any).getRawPage?.()?.url?.() || actualFinalUrlStr;
      console.log(`[NormalizeService] page.url()="${pageUrlStr}" page.getFinalUrl()="${actualFinalUrlStr}" São iguais?=${pageUrlStr === actualFinalUrlStr}`);
      console.log(`[NormalizeService] urlUsadaParaDetectarMarketplace="${actualFinalUrlStr}"`);

      // Validar se o host final de fato pertence a um marketplace suportado
      if (!MarketplaceHostRegistry.isKnownMarketplace(actualFinalUrl.hostname)) {
        throw new Error(`Marketplace não suportado: ${actualFinalUrl.hostname}`);
      }

      // 6. Identificar o plugin correspondente pela URL final real
      const plugin = this.registry.resolve(actualFinalUrl);
      const marketplace = plugin.getMarketplaceName();
      console.log(`[NormalizeService] marketplaceFinal="${marketplace}" pluginFinal="${plugin.constructor.name}"`);

      // 7. Executar extração polimórfica pelo plugin correspondente
      const product = await plugin.normalize(session.page, actualFinalUrl);
      console.log(`[NormalizeService] idProduto="${product.id_produto}" titulo="${product.titulo}" imagem="${product.imagem}" urlFinalResposta="${product.url_final}"`);

      const durationMs = Math.round(performance.now() - startTime);

      if (profileId && this.sessionManager) {
        await this.sessionManager.updateUsage(marketplace, profileId, true);
      }

      // Publicar evento NORMALIZE_COMPLETED
      this.eventBus.publish({
        eventId: crypto.randomUUID(),
        event: 'NORMALIZE_COMPLETED',
        version: 1,
        occurredAt: new Date().toISOString(),
        source: 'NormalizeService',
        traceId: traceId || null,
        requestId: requestId || null,
        sessionId: null,
        marketplace,
        profileId: profileId || null,
        payload: {
          url: originalUrlString,
          marketplace,
          durationMs
        }
      });

      // 8. Publicar evento NORMALIZATION_COMPLETED (retrocompatibilidade)
      this.eventBus.publish({
        eventId: crypto.randomUUID(),
        event: 'NORMALIZATION_COMPLETED',
        version: 1,
        occurredAt: new Date().toISOString(),
        source: 'NormalizeService',
        traceId: traceId || null,
        requestId: requestId || null,
        sessionId: null,
        marketplace,
        profileId: profileId || null,
        payload: {
          url: originalUrlString,
          marketplace,
          durationMs
        }
      });

      // 9. Publicar evento PRODUCT_EXTRACTED
      this.eventBus.publish({
        eventId: crypto.randomUUID(),
        event: 'PRODUCT_EXTRACTED',
        version: 1,
        occurredAt: new Date().toISOString(),
        source: 'NormalizeService',
        traceId: traceId || null,
        requestId: requestId || null,
        sessionId: null,
        marketplace,
        profileId: profileId || null,
        payload: {
          marketplace,
          id: product.id_produto
        }
      });

      return product;
    } catch (err: any) {
      if (profileId && this.sessionManager) {
        let status: SessionStatus = 'UNKNOWN';
        if (err instanceof ChallengeDetectedError) {
          if (err.type === 'LOGIN') {
            status = 'LOGIN_REQUIRED';
            this.eventBus.publish({
              eventId: crypto.randomUUID(),
              event: 'LOGIN_REQUIRED',
              version: 1,
              occurredAt: new Date().toISOString(),
              source: 'NormalizeService',
              traceId: traceId || null,
              requestId: requestId || null,
              sessionId: null,
              marketplace: initialMarketplace,
              profileId,
              payload: { marketplace: initialMarketplace, profileId, reason: err.message }
            });
            this.eventBus.publish({
              eventId: crypto.randomUUID(),
              event: 'SESSION_EXPIRED',
              version: 1,
              occurredAt: new Date().toISOString(),
              source: 'NormalizeService',
              traceId: traceId || null,
              requestId: requestId || null,
              sessionId: null,
              marketplace: initialMarketplace,
              profileId,
              payload: { marketplace: initialMarketplace, profileId, reason: 'Session expired, login required' }
            });
          } else if (err.type === 'CAPTCHA' || err.type === 'WAF') {
            status = 'CAPTCHA_REQUIRED';
            this.eventBus.publish({
              eventId: crypto.randomUUID(),
              event: 'CAPTCHA_REQUIRED',
              version: 1,
              occurredAt: new Date().toISOString(),
              source: 'NormalizeService',
              traceId: traceId || null,
              requestId: requestId || null,
              sessionId: null,
              marketplace: initialMarketplace,
              profileId,
              payload: { marketplace: initialMarketplace, profileId, reason: err.message }
            });
          }
        }
        await this.sessionManager.updateUsage(initialMarketplace, profileId, false, status, err.message);
      }

      // Publicar evento NORMALIZATION_FAILED caso falhe
      this.eventBus.publish({
        eventId: crypto.randomUUID(),
        event: 'NORMALIZATION_FAILED',
        version: 1,
        occurredAt: new Date().toISOString(),
        source: 'NormalizeService',
        traceId: traceId || null,
        requestId: requestId || null,
        sessionId: null,
        marketplace: initialMarketplace,
        profileId: profileId || null,
        payload: {
          url: originalUrlString,
          marketplace: initialMarketplace,
          reason: err.message || 'Erro de navegação ou extração'
        }
      });

      throw err;
    } finally {
      // 10. Sempre executar dispose() para liberar recursos
      await session.dispose().catch(() => {});
    }
  }
}
