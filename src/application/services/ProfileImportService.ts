import * as zlib from 'node:zlib';
import { IProfileImporterService, IProfileImporter } from '../../domain/ports/IProfileImporter.js';
import { IProfileValidator } from '../../domain/ports/IProfileValidator.js';
import { ProfilePackage } from '../../domain/models/ProfilePackage.js';

export class ProfileImportService implements IProfileImporterService {
  constructor(
    private importer: IProfileImporter,
    private validator: IProfileValidator
  ) {}

  public async importProfile(profileBuffer: Buffer): Promise<{ marketplace: string; profileId: string; version: number }> {
    // 1. Descomprimir buffer
    const jsonString = await new Promise<string>((resolve, reject) => {
      zlib.gunzip(profileBuffer, (err, buffer) => {
        if (err) {
          reject(new Error(`Invalid profile format or corrupted file: ${err.message}`));
        } else {
          resolve(buffer.toString('utf8'));
        }
      });
    });

    // 2. Parsear JSON
    let pkg: ProfilePackage;
    try {
      pkg = JSON.parse(jsonString);
    } catch (err: any) {
      throw new Error(`Profile package is not a valid JSON structure: ${err.message}`);
    }

    // 3. Validar pacote
    const validation = await this.validator.validatePackage(pkg);
    if (!validation.isValid) {
      throw new Error(`Profile validation failed: ${validation.errors.join(', ')}`);
    }

    // 4. Importar / Persistir
    await this.importer.importPackage(pkg);

    return {
      marketplace: pkg.manifest.marketplace,
      profileId: pkg.manifest.profileId,
      version: pkg.manifest.profileVersion
    };
  }
}
