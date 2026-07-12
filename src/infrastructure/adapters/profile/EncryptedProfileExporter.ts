import { execSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import { IProfileExporter } from '../../../domain/ports/IProfileExporter.js';
import { IProfileRepository } from '../../../domain/ports/IProfileRepository.js';
import { ProfilePackage, ProfileManifest } from '../../../domain/models/ProfilePackage.js';

export class EncryptedProfileExporter implements IProfileExporter {
  constructor(private repository: IProfileRepository) {}

  public async exportPackage(marketplace: string, profileId: string): Promise<ProfilePackage> {
    const data = await this.repository.loadEncrypted(marketplace, profileId);
    if (!data) {
      throw new Error(`Profile ${profileId} not found in marketplace ${marketplace}`);
    }

    const { metadata, storageStateEnc } = data;

    // Calcular o checksum SHA-256 da string criptografada
    const checksum = crypto.createHash('sha256').update(storageStateEnc).digest('hex');

    // Obter git SHA
    let gitSha = 'unknown';
    try {
      gitSha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch (e) {
      // Ignorar e manter 'unknown'
    }

    const manifest: ProfileManifest = {
      profileFormatVersion: 1,
      applicationVersion: '0.7.0',
      gitSha,
      marketplace: marketplace.toLowerCase(),
      profileId,
      profileVersion: metadata.version || 1,
      createdAt: metadata.createdAt || new Date().toISOString(),
      exportedAt: new Date().toISOString(),
      browserEngine: 'playwright-chromium',
      browserVersion: metadata.browserVersion || 'unknown',
      nodeVersion: process.version,
      osPlatform: process.platform,
      checksum,
      hashAlgorithm: 'sha256',
      encryptionVersion: 'aes-256-gcm'
    };

    // Atualizar no metadata o campo lastExport
    metadata.lastExport = manifest.exportedAt;
    await this.repository.saveEncrypted(marketplace, profileId, metadata, storageStateEnc);

    return {
      manifest,
      metadata,
      storageStateEnc
    };
  }
}
