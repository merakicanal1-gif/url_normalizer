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
    this.logger.info(`[AuthenticationService] Iniciando fluxo de autenticação para ${marketplace}/${profileId}`);

    // 1. Identificar o plugin do marketplace e obter a URL de login
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

    // 2. Criar ou carregar o perfil de sessão se ele não existir (Auto-creation)
    let profile = await this.profileManager.getProfile(marketplace, profileId);
    if (!profile) {
      this.logger.info(`[AuthenticationService] Perfil ${profileId} não encontrado. Criando automaticamente...`);
      profile = await this.profileManager.createProfile(marketplace, profileId, 'system-auto');
    }

    // 3. Obter o Interactive Browser Singleton
    let browser: any;
    try {
      browser = this.browserRuntime.getInteractiveBrowser();
    } catch (err: any) {
      this.logger.error('[AuthenticationService] Falha ao obter Interactive Browser', err);
      throw new Error(`Serviço de navegador indisponível: ${err.message}`);
    }

    // 4. Criar um novo BrowserContext através do BrowserContextFactory
    const context = await BrowserContextFactory.createInteractiveContext(browser, this.browserProfile);
    
    // 5. Criar uma nova Page
    const page = await context.newPage();

    // 6. Navegar para a URL obtida do Plugin
    try {
      this.logger.info(`[AuthenticationService] Navegando para a página de login: ${entryUrl}`);
      await page.goto(entryUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
    } catch (err: any) {
      this.logger.error(`[AuthenticationService] Falha ao navegar para ${entryUrl}. Fechando recursos.`, err);
      
      // Fechar imediatamente Page e BrowserContext
      await page.close().catch(() => {});
      await BrowserContextFactory.disposeContext(context).catch(() => {});

      // Publicar AUTHENTICATION_FAILED
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

    // 7. Se a navegação foi bem-sucedida, criar e registrar a sessão de autenticação
    const authenticationId = `auth_${crypto.randomUUID()}`;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + 15 * 60 * 1000); // 15 minutos de expiração

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

    // Registrar no AuthenticationRegistry
    this.registry.register(authenticationId, session);

    // Publicar AUTHENTICATION_STARTED
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

    // Publicar PAGE_NAVIGATED
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

    // 8. Retornar exatamente o contrato HTTP
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

    // 1. Localizar no Registry
    const session = this.registry.get(authenticationId);
    if (!session) {
      this.logger.error(`[AuthenticationService] Autenticação não encontrada: ${authenticationId}`);
      const err = new Error('Authentication not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    // 2. Validar marketplace/profile
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

    // 4. Obter o estado de armazenamento
    let storageState: any;
    try {
      storageState = await context.storageState();
    } catch (err: any) {
      this.logger.error(`[AuthenticationService] Erro ao obter storageState para ${authenticationId}`, err);
      throw err;
    }

    // Obter versão do browser
    const browserVersion = context.browser()?.version() || 'unknown';

    // 5. Persistir estado do perfil via ProfileManager
    await this.profileManager.saveProfileState(marketplace, profileId, storageState, browserVersion);

    // Carregar perfil para obter a versão incrementada
    const profile = await this.profileManager.getProfile(marketplace, profileId);
    const profileVersion = profile?.metadata?.version || 1;
    const savedAt = new Date().toISOString();

    // 8. Publicar PROFILE_SAVED
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

    // Publicar AUTHENTICATION_COMPLETED
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

    // 9. Fechar recursos
    await page.close().catch(() => {});
    await BrowserContextFactory.disposeContext(context).catch(() => {});

    // 10. Remover do Registry
    this.registry.remove(authenticationId);

    // 11. Retornar dados de sucesso
    return {
      success: true,
      profileVersion,
      savedAt
    };
  }
}
