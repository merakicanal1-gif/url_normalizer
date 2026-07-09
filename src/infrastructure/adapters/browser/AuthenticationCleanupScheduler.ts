import { AuthenticationRegistry } from './AuthenticationRegistry.js';
import { IApplicationEventBus } from '../../../domain/ports/IApplicationEventBus.js';
import { BrowserContextFactory } from './BrowserContextFactory.js';
import * as crypto from 'node:crypto';

export class AuthenticationCleanupScheduler {
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private registry: AuthenticationRegistry,
    private eventBus: IApplicationEventBus,
    private logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string, err?: any) => void },
    private intervalMs: number = 60000
  ) {}

  public start(): void {
    if (this.intervalId) return;

    this.logger.info('[AuthenticationCleanupScheduler] Inicializando o scheduler de limpeza...');
    this.intervalId = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, this.intervalMs);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('[AuthenticationCleanupScheduler] Scheduler de limpeza parado.');
    }
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const sessions = this.registry.list();

    for (const session of sessions) {
      if (session.expiresAt <= now) {
        this.logger.warn(
          `[AuthenticationCleanupScheduler] Sessão expirada detectada: ${session.authenticationId} (marketplace: ${session.marketplace}, profile: ${session.profileId})`
        );

        try {
          if (session.context) {
            await BrowserContextFactory.disposeContext(session.context);
          }
        } catch (err: any) {
          this.logger.error(
            `[AuthenticationCleanupScheduler] Erro ao fechar o BrowserContext da sessão expirada: ${session.authenticationId}`,
            err
          );
        } finally {
          this.registry.remove(session.authenticationId);

          this.eventBus.publish({
            eventId: crypto.randomUUID(),
            event: 'AUTHENTICATION_EXPIRED',
            version: 1,
            occurredAt: new Date().toISOString(),
            source: 'AuthenticationCleanupScheduler',
            traceId: null,
            requestId: null,
            sessionId: null,
            marketplace: session.marketplace,
            profileId: session.profileId,
            payload: {
              marketplace: session.marketplace,
              profileId: session.profileId,
              authenticationId: session.authenticationId
            }
          });
        }
      }
    }
  }
}
