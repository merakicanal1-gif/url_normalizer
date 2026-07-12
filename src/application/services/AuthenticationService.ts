import * as crypto from 'node:crypto';
import { IBrowserRuntime } from '../../domain/ports/IBrowserRuntime.js';
import { AuthenticationRegistry, AuthenticationSession } from '../../infrastructure/adapters/browser/AuthenticationRegistry.js';
import { BrowserContextFactory } from '../../infrastructure/adapters/browser/BrowserContextFactory.js';
import { IApplicationEventBus } from '../../domain/ports/IApplicationEventBus.js';
import { MarketplaceRegistry } from '../registry/MarketplaceRegistry.js';
import { IProfileManager } from '../../domain/ports/IProfileManager.js';
import { BrowserProfile } from '../../domain/models/BrowserProfile.js';

export class AuthenticationService {
  constructor(
    private browserRuntime: IBrowserRuntime,
    private registry: AuthenticationRegistry,
    private eventBus: IApplicationEventBus,
    private marketplaceRegistry: MarketplaceRegistry,
    private profileManager: IProfileManager,
    private browserProfile: BrowserProfile,
    private contextFactory: BrowserContextFactory,
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {
    this.logger.info(`[AuthenticationService] Inicializado com runtimeId=${(this.browserRuntime as any).runtimeId}`);
  }

  public async authenticate(
    marketplace: string,
    profileId: string,
    traceId?: string | null,
    requestId?: string | null
  ): Promise<{
    authenticationId: string;
    marketplace: string;
    profileId: string;
    status: string;
    startedAt: string;
    expiresAt: string;
  }> {
    if (process.env.INTERACTIVE_BROWSER_ENABLED === 'false') {
      throw new Error('INTERACTIVE_AUTHENTICATION_UNAVAILABLE');
    }
    this.logger.info(`[AuthenticationService] Iniciando fluxo de autenticação para ${marketplace}/${profileId}`);

    const plugin = this.marketplaceRegistry.getPlugins().find(
      p => p.getMarketplaceName() === marketplace.toLowerCase()
    );
    if (!plugin) {
      this.logger.error(`[AuthenticationService] Marketplace não suportado: ${marketplace}`);
      throw new Error(`Marketplace não suportado: ${marketplace}`);
    }

    const entryUrl = plugin.getInteractiveEntryUrl();
    if (!entryUrl) {
      this.logger.error(`[AuthenticationService] URL de login não definida para o marketplace: ${marketplace}`);
      throw new Error(`URL de login não definida para o marketplace: ${marketplace}`);
    }

    let profile = await this.profileManager.getProfile(marketplace, profileId);
    if (!profile) {
      this.logger.info(`[AuthenticationService] Perfil ${profileId} não encontrado. Criando automaticamente...`);
      profile = await this.profileManager.createProfile(marketplace, profileId, 'system-auto');
    }

    let browser: any;
    try {
      browser = this.browserRuntime.getInteractiveBrowser();
    } catch (err: any) {
      this.logger.error('[AuthenticationService] Falha ao obter Interactive Browser', err);
      throw new Error(`Serviço de navegador indisponível: ${err.message}`);
    }

    const context = await this.contextFactory.createInteractiveContext(browser, this.browserProfile);
    const page = await context.newPage();

    try {
      this.logger.info(`[AuthenticationService] Navegando para a página de login: ${entryUrl}`);
      await page.goto(entryUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
    } catch (err: any) {
      this.logger.error(`[AuthenticationService] Falha ao navegar para ${entryUrl}. Fechando recursos.`, err);
      
      await page.close().catch(() => {});
      await this.contextFactory.disposeContext(context).catch(() => {});

      this.eventBus.publish({
        eventId: crypto.randomUUID(),
        event: 'AUTHENTICATION_FAILED',
        version: 1,
        occurredAt: new Date().toISOString(),
        source: 'AuthenticationService',
        traceId: traceId || null,
        requestId: requestId || null,
        sessionId: null,
        marketplace,
        profileId,
        payload: {
          marketplace,
          profileId,
          authenticationId: '',
          reason: `Falha na navegação inicial: ${err.message}`
        }
      });

      throw new Error(`Falha ao abrir a página de login: ${err.message}`);
    }

    const authenticationId = `auth_${crypto.randomUUID()}`;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + 15 * 60 * 1000);

    const session: AuthenticationSession = {
      authenticationId,
      marketplace,
      profileId,
      context,
      page,
      startedAt,
      expiresAt,
      status: 'WAITING_LOGIN'
    };

    this.registry.register(authenticationId, session);

    this.eventBus.publish({
      eventId: crypto.randomUUID(),
      event: 'AUTHENTICATION_STARTED',
      version: 1,
      occurredAt: startedAt.toISOString(),
      source: 'AuthenticationService',
      traceId: traceId || null,
      requestId: requestId || null,
      sessionId: null,
      marketplace,
      profileId,
      payload: {
        marketplace,
        profileId,
        authenticationId
      }
    });

    this.eventBus.publish({
      eventId: crypto.randomUUID(),
      event: 'PAGE_NAVIGATED',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'AuthenticationService',
      traceId: traceId || null,
      requestId: requestId || null,
      sessionId: null,
      marketplace,
      profileId,
      payload: {
        url: entryUrl
      }
    });

    return {
      authenticationId,
      marketplace,
      profileId,
      status: 'WAITING_LOGIN',
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
  }

  public async finishAuthentication(
    marketplace: string,
    profileId: string,
    authenticationId: string
  ): Promise<{
    success: boolean;
    profileVersion: number;
    savedAt: string;
  }> {
    this.logger.info(`[AuthenticationService] Finalizando autenticação para ${marketplace}/${profileId} com ID: ${authenticationId}`);

    const session = this.registry.get(authenticationId);
    if (!session) {
      this.logger.error(`[AuthenticationService] Autenticação não encontrada: ${authenticationId}`);
      const err = new Error('Authentication not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    if (
      session.marketplace.toLowerCase() !== marketplace.toLowerCase() ||
      session.profileId !== profileId
    ) {
      this.logger.error(`[AuthenticationService] Incompatibilidade de perfil/marketplace para ${authenticationId}`);
      const err = new Error('Authentication not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    const { context, page } = session;

    let storageState: any;
    try {
      storageState = await context.storageState();
    } catch (err: any) {
      this.logger.error(`[AuthenticationService] Erro ao obter storageState para ${authenticationId}`, err);
      throw err;
    }

    const browserVersion = context.browser()?.version() || 'unknown';

    await this.profileManager.saveProfileState(marketplace, profileId, storageState, browserVersion);

    const profile = await this.profileManager.getProfile(marketplace, profileId);
    const profileVersion = profile?.metadata?.version || 1;
    const savedAt = new Date().toISOString();

    this.eventBus.publish({
      eventId: crypto.randomUUID(),
      event: 'PROFILE_SAVED',
      version: 1,
      occurredAt: savedAt,
      source: 'AuthenticationService',
      traceId: null,
      requestId: null,
      sessionId: null,
      marketplace,
      profileId,
      payload: {
        marketplace,
        profileId,
        version: profileVersion
      }
    });

    this.eventBus.publish({
      eventId: crypto.randomUUID(),
      event: 'AUTHENTICATION_COMPLETED',
      version: 1,
      occurredAt: savedAt,
      source: 'AuthenticationService',
      traceId: null,
      requestId: null,
      sessionId: null,
      marketplace,
      profileId,
      payload: {
        marketplace,
        profileId,
        authenticationId
      }
    });

    await page.close().catch(() => {});
    await this.contextFactory.disposeContext(context).catch(() => {});

    this.registry.remove(authenticationId);

    return {
      success: true,
      profileVersion,
      savedAt
    };
  }
}
