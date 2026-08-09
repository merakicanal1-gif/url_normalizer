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
import { AffiliateLinkGenerator } from './AffiliateLinkGenerator.js';
import { UnsupportedMarketplaceError } from '../../domain/errors/UnsupportedMarketplaceError.js';
import { ProductNotFoundError } from '../../domain/errors/ProductNotFoundError.js';
import { ProductUnavailableError } from '../../domain/errors/ProductUnavailableError.js';
import { AffiliateLinkError } from '../../domain/errors/AffiliateLinkError.js';
import { INavigatorPage } from '../../domain/ports/INavigator.js';

export class NormalizeService {
  private telemetry: INormalizeTelemetry;
  private affiliateGenerator = new AffiliateLinkGenerator();

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
        console.log(`[NormalizeService] resolvedUrl="${resolved.finalUrl}" resolver="${resolved.metadata.resolver}"`);

        // Garantir que a página está na URL final resolvida
        const currentUrlStr = activeSession.page.getFinalUrl();
        if (currentUrlStr !== resolved.finalUrl) {
          await activeSession.page.goto(resolved.finalUrl, this.defaultTimeoutMs);
        }

        // Identificar o marketplace real analisando a página carregada
        const identifiedMarketplace = await this.identifyMarketplace(activeSession.page);
        console.log(`[NormalizeService] Marketplace identificado após carregamento da página: "${identifiedMarketplace}"`);

        // Validar se o marketplace de fato é suportado (apenas Amazon e Mercado Livre são suportados)
        const supportedMarketplaces = ['amazon', 'mercadolivre'];
        if (!supportedMarketplaces.includes(identifiedMarketplace)) {
          throw new UnsupportedMarketplaceError(`Marketplace não suportado: ${new URL(resolved.finalUrl).hostname}`);
        }

        // Se o marketplace identificado for diferente do estimado inicial, recriar a sessão com o perfil isolado correspondente
        if (identifiedMarketplace !== initialMarketplace) {
          console.log(`[DIAGNOSTIC] [NormalizeService] Mudança de marketplace detectada: ${initialMarketplace} -> ${identifiedMarketplace}. Recriando sessão...`);
          await activeSession.dispose().catch(() => {});
          activeSession = await this.sessionFactory.createSession(identifiedMarketplace, profileId);
          this.telemetry.browserCreated({ runtime: 'worker', browserMode: 'headless' });
          
          const newRawPage = (activeSession.page as any).getRawPage?.();
          const newCookies = newRawPage ? await newRawPage.context().cookies() : [];
          
          if (profileId && newCookies.length > 0) {
            this.telemetry.storageStateLoaded({ profileId, cookiesCount: newCookies.length });
          }

          // Navegar para a URL resolvida na nova sessão
          await activeSession.page.goto(resolved.finalUrl, this.defaultTimeoutMs);
        }

        // Obter a URL real final após qualquer redirecionamento na nova sessão
        const actualFinalUrlStr = activeSession.page.getFinalUrl();
        const actualFinalUrl = new URL(actualFinalUrlStr);

        // Identificar o plugin correspondente pela URL final real
        const plugin = this.registry.resolve(actualFinalUrl);
        const marketplace = plugin.getMarketplaceName();
        this.telemetry.resolvedMarketplace(marketplace);

        // Executar extração pelo plugin correspondente
        const product = await plugin.normalize(activeSession.page, actualFinalUrl);

        // Se o plugin não retornou um link de afiliado, gerar pelo gerador secundário
        if (!product.link_afiliado) {
          product.link_afiliado = this.affiliateGenerator.generate(
            product.marketplace,
            product.url_produto,
            product.id_produto
          );
        }

        const durationMs = Math.round(performance.now() - startTime);

        // Registrar resultado da telemetria
        this.telemetry.normalizeResult({
          marketplace,
          productId: product.id_produto || 'UNKNOWN',
          canonicalUrl: product.url_produto,
          title: product.nome_produto || '',
          image: product.url_imagem || ''
        });

        this.telemetry.finished(product.url_produto, durationMs, 'UNKNOWN');

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
            id: product.id_produto || 'UNKNOWN'
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

  private async identifyMarketplace(page: INavigatorPage): Promise<string> {
    const urlStr = page.getFinalUrl();
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();

    // 1. Checar por hostname/domínio
    if (hostname.includes('amazon.')) {
      return 'amazon';
    }
    if (hostname.includes('mercadolivre.') || hostname.includes('mercadolibre.') || hostname.includes('meli.la')) {
      return 'mercadolivre';
    }
    if (hostname.includes('shopee.')) {
      return 'shopee';
    }

    // 2. Checar por assinaturas no DOM/HTML como fallback
    try {
      const raw = (page as any).getRawPage?.();
      if (raw) {
        const hasAmazonLogo = await raw.locator('a[href*="/ref=nav_logo"], #nav-logo-sprites, #amzn-ss-wrap').count().catch(() => 0) > 0;
        if (hasAmazonLogo) return 'amazon';

        const hasMeliLogo = await raw.locator('.nav-logo, a[href*="mercadolivre.com.br"], #shortcut-menu').count().catch(() => 0) > 0;
        if (hasMeliLogo) return 'mercadolivre';
      }
    } catch (e) {
      // ignorar erros
    }

    return 'generic';
  }
}
