import { SessionStatus } from '../models/AuthenticationSessionStatus.js';

export interface IAuthenticationSessionManager {
  updateUsage(
    marketplace: string,
    profileId: string,
    success: boolean,
    status?: SessionStatus | null,
    errorReason?: string | null
  ): Promise<void>;
  updateValidation(
    marketplace: string,
    profileId: string,
    status: SessionStatus
  ): Promise<void>;
  updateRefresh(
    marketplace: string,
    profileId: string,
    status: SessionStatus,
    confidence: number
  ): Promise<void>;
}
