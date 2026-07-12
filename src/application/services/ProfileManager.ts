import { IProfileManager } from '../../domain/ports/IProfileManager.js';
import { IProfileRepository } from '../../domain/ports/IProfileRepository.js';
import { ISessionLock } from '../../domain/ports/ISessionLock.js';
import { IApplicationEventBus } from '../../domain/ports/IApplicationEventBus.js';
import * as crypto from 'node:crypto';

export class ProfileManager implements IProfileManager {
  constructor(
    private repository: IProfileRepository,
    private lockManager: ISessionLock,
    private logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void },
    private eventBus?: IApplicationEventBus
  ) {}

  public async getProfile(marketplace: string, profileId: string): Promise<any | null> {
    const data = await this.repository.load(marketplace, profileId);
    if (!data) return null;
    return {
      id: profileId,
      marketplace: marketplace.toLowerCase(),
      status: 'ACTIVE',
      metadata: data.metadata,
      storageState: data.storageState
    };
  }

  public async createProfile(marketplace: string, profileId: string, createdBy?: string): Promise<any> {
    const existing = await this.repository.load(marketplace, profileId);
    if (existing) {
      throw new Error(`Profile ${profileId} already exists in marketplace ${marketplace}`);
    }

    const metadata = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastAuthentication: null,
      playwrightVersion: '1.45.0',
      browserVersion: null,
      marketplace: marketplace.toLowerCase(),
      profileId: profileId,
      version: 1,
      createdBy: createdBy || 'system'
    };

    await this.repository.save(marketplace, profileId, metadata, null);

    if (this.eventBus) {
      this.eventBus.publish({
        eventId: crypto.randomUUID(),
        event: 'PROFILE_CREATED',
        version: 1,
        occurredAt: new Date().toISOString(),
        source: 'ProfileManager',
        traceId: null,
        requestId: null,
        sessionId: null,
        marketplace: marketplace.toLowerCase(),
        profileId,
        payload: {
          marketplace: marketplace.toLowerCase(),
          profileId,
          createdBy: createdBy || 'system'
        }
      });
    }

    return {
      id: profileId,
      marketplace: marketplace.toLowerCase(),
      status: 'ACTIVE',
      metadata
    };
  }

  public async saveProfileState(marketplace: string, profileId: string, storageState: any, browserVersion?: string): Promise<void> {
    await this.lockManager.acquire(profileId);
    try {
      const data = await this.repository.load(marketplace, profileId);
      const metadata = data?.metadata ? { ...data.metadata } : {
        createdAt: new Date().toISOString(),
        marketplace: marketplace.toLowerCase(),
        profileId: profileId,
        createdBy: 'system',
        version: 0
      };

      metadata.updatedAt = new Date().toISOString();
      metadata.lastAuthentication = new Date().toISOString();
      metadata.playwrightVersion = '1.45.0';
      if (browserVersion) {
        metadata.browserVersion = browserVersion;
      }
      metadata.version = (metadata.version || 0) + 1;

      await this.repository.save(marketplace, profileId, metadata, storageState);
    } finally {
      await this.lockManager.release(profileId);
    }
  }

  public async deleteProfile(marketplace: string, profileId: string): Promise<void> {
    await this.repository.delete(marketplace, profileId);
  }

  public async listProfiles(marketplace?: string): Promise<any[]> {
    const list = await this.repository.list(marketplace);
    return list.map(item => ({
      id: item.id,
      marketplace: item.marketplace,
      status: 'ACTIVE',
      metadata: item.metadata
    }));
  }

  public async validateProfile(marketplace: string, profileId: string): Promise<boolean> {
    const data = await this.repository.load(marketplace, profileId);
    return !!data && !!data.storageState;
  }

  public async importProfile(marketplace: string, profile: any): Promise<void> {
    await this.repository.save(marketplace, profile.id, profile.metadata, profile.storageState);
  }

  public async importStorageState(marketplace: string, profileId: string, storageState: any): Promise<{ profileVersion: number; importedAt: string }> {
    const data = await this.repository.load(marketplace, profileId);
    const metadata = data?.metadata ? { ...data.metadata } : {
      createdAt: new Date().toISOString(),
      marketplace: marketplace.toLowerCase(),
      profileId: profileId,
      createdBy: 'system',
      version: 0
    };

    metadata.updatedAt = new Date().toISOString();
    metadata.lastAuthentication = new Date().toISOString();
    metadata.version = (metadata.version || 0) + 1;

    await this.repository.save(marketplace, profileId, metadata, storageState);

    return {
      profileVersion: metadata.version,
      importedAt: metadata.updatedAt
    };
  }

  public async loadStorageState(marketplace: string, profileId: string): Promise<any | null> {
    const data = await this.repository.load(marketplace, profileId);
    return data ? data.storageState : null;
  }
}
