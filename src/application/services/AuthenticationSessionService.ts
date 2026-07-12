import { IAuthenticationStatusResolver } from '../../domain/ports/IAuthenticationStatusResolver.js';
import { SessionDiagnostic } from '../../domain/models/AuthenticationSessionStatus.js';

export class AuthenticationSessionService {
  constructor(private statusResolver: IAuthenticationStatusResolver) {}

  public async getDiagnostic(marketplace: string, profileId: string): Promise<SessionDiagnostic> {
    return this.statusResolver.resolveStatus(marketplace, profileId);
  }
}
