import { MarketplaceRegistry } from '../registry/MarketplaceRegistry.js';
import { IAuthenticationHealthChecker } from '../../domain/ports/IAuthenticationHealthChecker.js';
import { IAuthenticationSessionManager } from '../../domain/ports/IAuthenticationSessionManager.js';
import { IAuthenticationStatusResolver } from '../../domain/ports/IAuthenticationStatusResolver.js';
import { SessionDiagnostic } from '../../domain/models/AuthenticationSessionStatus.js';

export class AuthenticationHealthService {
  constructor(
    private registry: MarketplaceRegistry,
    private healthChecker: IAuthenticationHealthChecker,
    private sessionManager: IAuthenticationSessionManager,
    private statusResolver: IAuthenticationStatusResolver
  ) {}

  public async refreshSession(marketplace: string, profileId: string): Promise<SessionDiagnostic> {
    const plugins = this.registry.getPlugins();
    const plugin = plugins.find(p => p.getMarketplaceName() === marketplace.toLowerCase());
    if (!plugin) {
      throw new Error(`Marketplace not supported: ${marketplace}`);
    }

    const strategy = plugin.getAuthenticationStrategy();
    if (!strategy) {
      throw new Error(`Authentication strategy not defined for marketplace: ${marketplace}`);
    }

    const result = await this.healthChecker.checkHealth(marketplace, profileId, strategy);

    // Atualizar no session manager
    await this.sessionManager.updateRefresh(marketplace, profileId, result.status, result.confidence);

    // Retornar novo diagnóstico atualizado
    return this.statusResolver.resolveStatus(marketplace, profileId);
  }
}
