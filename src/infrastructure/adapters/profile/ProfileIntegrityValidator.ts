import * as crypto from 'node:crypto';
import { IProfileValidator, ProfileValidationResult } from '../../../domain/ports/IProfileValidator.js';
import { IProfileRepository } from '../../../domain/ports/IProfileRepository.js';
import { SecureCryptoHelper } from '../session/SecureCryptoHelper.js';
import { ProfilePackage } from '../../../domain/models/ProfilePackage.js';

export class ProfileIntegrityValidator implements IProfileValidator {
  constructor(
    private repository: IProfileRepository,
    private cryptoHelper: SecureCryptoHelper
  ) {}

  public async validateStructure(marketplace: string, profileId: string): Promise<ProfileValidationResult> {
    const errors: string[] = [];
    let profileExists = false;
    let metadataExists = false;
    let storageStateExists = false;
    let checksumValid = true;

    const data = await this.repository.loadEncrypted(marketplace, profileId).catch(() => null);

    if (!data) {
      errors.push(`Profile files not found in repository for ${marketplace}/${profileId}`);
      return {
        isValid: false,
        errors
      };
    }

    profileExists = true;
    if (data.metadata) {
      metadataExists = true;
    } else {
      errors.push('metadata.json is missing or invalid');
    }

    if (data.storageStateEnc) {
      storageStateExists = true;
      try {
        // Tentar descriptografar para verificar se a chave é capaz
        this.cryptoHelper.decrypt(data.storageStateEnc);
      } catch (err: any) {
        errors.push(`Encryption key verification failed: ${err.message}`);
      }
    } else {
      errors.push('storageState.enc is missing or invalid');
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors
    };
  }

  public async validatePackage(pkg: ProfilePackage): Promise<ProfileValidationResult> {
    const errors: string[] = [];

    if (!pkg) {
      errors.push('Profile package is null or undefined');
      return { isValid: false, errors };
    }

    const { manifest, metadata, storageStateEnc } = pkg;

    if (!manifest) {
      errors.push('manifest.json is missing in profile package');
      return { isValid: false, errors };
    }

    if (manifest.profileFormatVersion !== 1) {
      errors.push(`Incompatible profile format version: expected 1, found ${manifest.profileFormatVersion}`);
    }

    if (!metadata) {
      errors.push('metadata.json is missing in profile package');
    }

    if (!storageStateEnc) {
      errors.push('storageState.enc is missing in profile package');
    } else {
      // Validar checksum SHA-256
      const computedHash = crypto.createHash('sha256').update(storageStateEnc).digest('hex');
      if (computedHash !== manifest.checksum) {
        errors.push(`Checksum mismatch: manifest has ${manifest.checksum}, computed ${computedHash}`);
      }

      // Validar capacidade de descriptografar no ambiente atual
      try {
        this.cryptoHelper.decrypt(storageStateEnc);
      } catch (err: any) {
        errors.push(`Decryption failed on target environment (key mismatch): ${err.message}`);
      }
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors
    };
  }
}
