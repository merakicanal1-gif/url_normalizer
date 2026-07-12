import { SessionDiagnostic } from '../models/AuthenticationSessionStatus.js';

export interface IAuthenticationStatusResolver {
  resolveStatus(marketplace: string, profileId: string): Promise<SessionDiagnostic>;
}
