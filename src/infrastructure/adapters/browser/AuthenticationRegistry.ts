export interface AuthenticationSession {
  authenticationId: string;
  marketplace: string;
  profileId: string;
  context: any; // BrowserContext do Playwright
  page: any; // Page do Playwright
  startedAt: Date;
  expiresAt: Date;
  status: 'WAITING_LOGIN' | 'LOGIN_IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
}

export class AuthenticationRegistry {
  private activeAuthentications = new Map<string, AuthenticationSession>();

  constructor(
    private logger?: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
  ) {}

  public register(authenticationId: string, session: AuthenticationSession): void {
    this.activeAuthentications.set(authenticationId, session);
    if (this.logger) {
      this.logger.info(`[AuthenticationRegistry] Sessão de autenticação registrada: ${authenticationId} para o perfil: ${session.profileId}`);
    }
  }

  public get(authenticationId: string): AuthenticationSession | undefined {
    return this.activeAuthentications.get(authenticationId);
  }

  public remove(authenticationId: string): void {
    const session = this.activeAuthentications.get(authenticationId);
    this.activeAuthentications.delete(authenticationId);
    if (this.logger && session) {
      this.logger.info(`[AuthenticationRegistry] Sessão de autenticação removida do registro: ${authenticationId}`);
    }
  }

  public list(): AuthenticationSession[] {
    return Array.from(this.activeAuthentications.values());
  }

  public size(): number {
    return this.activeAuthentications.size;
  }
}
