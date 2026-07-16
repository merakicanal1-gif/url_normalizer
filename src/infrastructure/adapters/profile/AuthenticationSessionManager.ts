import { IAuthenticationSessionManager } from '../../../domain/ports/IAuthenticationSessionManager.js';
import { IProfileRepository } from '../../../domain/ports/IProfileRepository.js';
import { ISessionLock } from '../../../domain/ports/ISessionLock.js';
import { SessionStatus } from '../../../domain/models/AuthenticationSessionStatus.js';

export class AuthenticationSessionManager implements IAuthenticationSessionManager {
  constructor(
    private repository: IProfileRepository,
    private lockManager: ISessionLock
  ) {}

  public async updateUsage(
    marketplace: string,
    profileId: string,
    success: boolean,
    status?: SessionStatus | null,
    errorReason?: string | null
  ): Promise<void> {
    const mkt = marketplace.toLowerCase();
    await this.lockManager.acquire(profileId);
    try {
      const metadata = await this.repository.loadMetadata(mkt, profileId);
      if (!metadata) return;

      // Incrementar usageCount
      metadata.usageCount = (metadata.usageCount || 0) + 1;
      metadata.lastValidation = new Date().toISOString();

      if (success) {
        metadata.lastSuccessfulNormalize = new Date().toISOString();
        metadata.authenticationStatus = 'VALID';
      } else {
        metadata.lastFailure = new Date().toISOString();
        metadata.lastFailureReason = errorReason || 'Unknown normalization failure';
        if (status) {
          metadata.authenticationStatus = status;
        }
      }

      await this.repository.saveMetadata(mkt, profileId, metadata);
    } finally {
      await this.lockManager.release(profileId);
    }
  }

  public async updateValidation(
    marketplace: string,
    profileId: string,
    status: SessionStatus
  ): Promise<void> {
    const mkt = marketplace.toLowerCase();
    await this.lockManager.acquire(profileId);
    try {
      const metadata = await this.repository.loadMetadata(mkt, profileId);
      if (!metadata) return;

      metadata.lastValidation = new Date().toISOString();
      metadata.authenticationStatus = status;

      await this.repository.saveMetadata(mkt, profileId, metadata);
    } finally {
      await this.lockManager.release(profileId);
    }
  }

  public async updateRefresh(
    marketplace: string,
    profileId: string,
    status: SessionStatus,
    confidence: number
  ): Promise<void> {
    const mkt = marketplace.toLowerCase();
    await this.lockManager.acquire(profileId);
    try {
      const metadata = await this.repository.loadMetadata(mkt, profileId);
      if (!metadata) return;

      metadata.lastValidation = new Date().toISOString();
      metadata.authenticationStatus = status;

      if (status === 'VALID') {
        metadata.lastSuccessfulRefresh = new Date().toISOString();
        metadata.lastAuthentication = new Date().toISOString(); // Refresh bem-sucedido renova a data de última autenticação ativa
      } else {
        metadata.lastFailure = new Date().toISOString();
        metadata.lastFailureReason = `Refresh detected session status: ${status}`;
      }

      await this.repository.saveMetadata(mkt, profileId, metadata);
    } finally {
      await this.lockManager.release(profileId);
    }
  }
}
