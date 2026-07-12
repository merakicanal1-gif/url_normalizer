import { IProfileImporter } from '../../../domain/ports/IProfileImporter.js';
import { IProfileRepository } from '../../../domain/ports/IProfileRepository.js';
import { ProfilePackage } from '../../../domain/models/ProfilePackage.js';

export class EncryptedProfileImporter implements IProfileImporter {
  constructor(private repository: IProfileRepository) {}

  public async importPackage(pkg: ProfilePackage): Promise<void> {
    const { manifest, metadata, storageStateEnc } = pkg;
    
    // Atualizar no metadata o campo lastImport
    metadata.lastImport = new Date().toISOString();
    metadata.authenticationStatus = 'IMPORTED';

    await this.repository.saveEncrypted(manifest.marketplace, manifest.profileId, metadata, storageStateEnc);
  }
}
