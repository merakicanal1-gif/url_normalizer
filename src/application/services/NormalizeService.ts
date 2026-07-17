import * as crypto from 'node:crypto';
import { IUrlResolver } from '../../domain/ports/IUrlResolver.js';
import { MarketplaceRegistry } from '../registry/MarketplaceRegistry.js';
import { NormalizedProduct } from '../../domain/models/Product.js';
import { IBrowserSessionFactory } from '../../domain/ports/IBrowserSessionFactory.js';
import { IApplicationEventBus } from '../../domain/ports/IApplicationEventBus.js';
import { MarketplaceHostRegistry } from '../../domain/services/MarketplaceHostRegistry.js';
import { ChallengeDetectedError } from '../../domain/errors/ChallengeDetectedError.js';
import { SessionStatus } from '../../domain/models/AuthenticationSessionStatus.js';
import { INormalizeTelemetry } from '../../domain/ports/INormalizeTelemetry.js';
import { NoOpNormalizeTelemetry } from '../../infrastructure/telemetry/NoOpNormalizeTelemetry.js';

export class NormalizeService {
  private telemetry: INormalizeTelemetry;

  constructor(
    private urlResolver: IUrlResolver,
    private registry: MarketplaceRegistry,
    private sessionFactory: IBrowserSessionFactory,
    private eventBus: IApplicationEventBus,
    private defaultTimeoutMs: number = 30000,
    telemetry?: INormalizeTelemetry
  ) {
    this.telemetry = telemetry || new NoOpNormalizeTelemetry();
  }

  public async normalize(
    originalUrlString: string,
    profileId?: string,
    traceId?: string | null,
    requestId?: string | null
  ): Promise<NormalizedProduct> {
    const executionId = crypto.randomUUID();

    return this.telemetry.run(executionId, originalUrlString, async () => {
      console.log(`----------------------------------\n[NormalizeService] originalUrl="${originalUrlString}" profileId="${profileId || 'undefined'}"\n----------------------------------`);

      // 1. Identificar o marketplace inicial estimado a partir da URL original
      const originalUrl = new URL(originalUrlString);
      let initialMarketplace = 'generic';
      if (MarketplaceHostRegistry.isAmazon(originalUrl.hostname) || MarketplaceHostRegistry.isAmazonAffiliate(originalUrl.hostname)) {
        initialMarketplace = 'amazon';
      } else if (MarketplaceHostRegistry.isMercadoLivre(originalUrl.hostname) || MarketplaceHostRegistry.isMercadoLivreAffiliate(originalUrl.hostname)) {
        initialMarketplace = 'mercadolivre';
      } else if (MarketplaceHostRegistry.isShopee(originalUrl.hostname) || MarketplaceHostRegistry.isShopeeAffiliate(originalUrl.hostname)) {
        initialMarketplace = 'shopee';
      }

      // Notificar início da telemetria
      this.telemetry.begin({
        originalUrl: originalUrlString,
        profileId,
        runtime: 'worker',
        browserMode: 'headless',
        authStatusBefore: 'UNKNOWN'
      });
      this.telemetry.estimatedMarketplace(initialMarketplace);

      // 2. Solicitar sessão worker
      const session = await this.sessionFactory.createSession(initialMarketplace, profileId);
      this.telemetry.browserCreated({ runtime: 'worker', browserMode: 'headless' });

      // Logs temporários de diagnóstico (Audit) e leitura de cookies
      const rawPage = (session.page as any).getRawPage?.();
      const cookies = rawPage ? await rawPage.context().cookies() : [];
      console.log(`[DIAGNOSTIC] [NormalizeService] marketplaceRecebido="${initialMarketplace}" profileId="${profileId || 'undefined'}" urlInicial="${originalUrlString}" BrowserContextReutilizadoOuCriado=true cookiesCarregados=${cookies.length}`);

      if (profileId && cookies.length > 0) {
        this.telemetry.storageStateLoaded({ profileId, cookiesCount: cookies.length });
      }

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

      const startTime = performance.now();
      let activeSession = session;

      try {
        // 4. Resolver redirecionamentos iniciais reutilizando a mesma sessão/página
        const resolved = await this.urlResolver.resolve(originalUrl, this.defaultTimeoutMs, profileId, session.page);
        const finalUrl = new URL(resolved.finalUrl);
        console.log(`[NormalizeService] resolvedUrl="${resolved.finalUrl}" resolver="${resolved.metadata.resolver}"`);

        // Identificar o marketplace final a partir da URL resolvida
        let finalMarketplace = 'generic';
        if (MarketplaceHostRegistry.isAmazon(finalUrl.hostname)) {
          finalMarketplace = 'amazon';
        } else if (MarketplaceHostRegistry.isMercadoLivre(finalUrl.hostname)) {
          finalMarketplace = 'mercadolivre';
        } else if (MarketplaceHostRegistry.isShopee(finalUrl.hostname)) {
          finalMarketplace = 'shopee';
        }

        // Se o resolvedor redirecionou para um marketplace diferente, recria a página
        if (finalMarketplace !== initialMarketplace) {
          console.log(`[DIAGNOSTIC] [NormalizeService] Mudança de marketplace detectada: ${initialMarketplace} -> ${finalMarketplace}. Recriando sessão...`);
          await session.dispose().catch(() => {});
          activeSession = await this.sessionFactory.createSession(finalMarketplace, profileId);
          this.telemetry.browserCreated({ runtime: 'worker', browserMode: 'headless' });
          
          const newRawPage = (activeSession.page as any).getRawPage?.();
          const newCookies = newRawPage ? await newRawPage.context().cookies() : [];
          
          if (profileId && newCookies.length > 0) {
            this.telemetry.storageStateLoaded({ profileId, cookiesCount: newCookies.length });
          }
        }

        // 5. Garantir que a página está na URL final resolvida
        const currentUrlStr = activeSession.page.getFinalUrl();
        if (currentUrlStr !== resolved.finalUrl) {
          await activeSession.page.goto(resolved.finalUrl, this.defaultTimeoutMs);
        }

        // Obter a URL real final da navegação na página (após redirecionamentos via JS/Client)
        const actualFinalUrlStr = activeSession.page.getFinalUrl();
        const actualFinalUrl = new URL(actualFinalUrlStr);

        // Validar se o host final de fato pertence a um marketplace suportado
        if (!MarketplaceHostRegistry.isKnownMarketplace(actualFinalUrl.hostname)) {
          throw new Error(`Marketplace não suportado: ${actualFinalUrl.hostname}`);
        }

        // 6. Identificar o plugin correspondente pela URL final real
        const plugin = this.registry.resolve(actualFinalUrl);
        const marketplace = plugin.getMarketplaceName();
        this.telemetry.resolvedMarketplace(marketplace);

        // 7. Executar extração pelo plugin correspondente
        const product = await plugin.normalize(activeSession.page, actualFinalUrl);

        const durationMs = Math.round(performance.now() - startTime);

        // Registrar resultado da telemetria
        this.telemetry.normalizeResult({
          marketplace,
          productId: product.id_produto,
          canonicalUrl: product.url_final,
          title: product.titulo,
          image: product.imagem
        });

        this.telemetry.finished(product.url_final, durationMs, 'UNKNOWN');

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
        const durationMs = Math.round(performance.now() - startTime);

        if (profileId && err instanceof ChallengeDetectedError) {
          if (err.type === 'LOGIN') {
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
          }
        }

        this.telemetry.failed(err.message || 'Erro de normalização', durationMs, 'UNKNOWN');

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
        await activeSession.dispose().catch(() => {});
      }
    });
  }
}
