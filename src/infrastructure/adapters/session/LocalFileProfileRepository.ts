import { IProfileRepository } from '../../../domain/ports/IProfileRepository.js';
import { SecureCryptoHelper } from './SecureCryptoHelper.js';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';

export class LocalFileProfileRepository implements IProfileRepository {
  private baseDir: string;

  constructor(
    private cryptoHelper: SecureCryptoHelper,
    baseDir?: string
  ) {
    this.baseDir = baseDir || process.env.SESSION_STORAGE_DIR || path.join(process.cwd(), 'data', 'profiles');
  }

  public async save(marketplace: string, profileId: string, metadata: any, storageState: any): Promise<void> {
    const dir = path.join(this.baseDir, marketplace.toLowerCase(), profileId);
    await fs.mkdir(dir, { recursive: true });

    // Criptografar e salvar storageState
    const plaintext = JSON.stringify(storageState);
    const encrypted = this.cryptoHelper.encrypt(plaintext);
    await fs.writeFile(path.join(dir, 'storageState.enc'), encrypted, 'utf8');

    // Salvar metadata em texto simples
    await fs.writeFile(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
  }

  public async saveEncrypted(marketplace: string, profileId: string, metadata: any, storageStateEnc: string): Promise<void> {
    const dir = path.join(this.baseDir, marketplace.toLowerCase(), profileId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'storageState.enc'), storageStateEnc, 'utf8');
    await fs.writeFile(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
  }

  public async load(marketplace: string, profileId: string): Promise<{ metadata: any; storageState: any } | null> {
    const dir = path.join(this.baseDir, marketplace.toLowerCase(), profileId);
    const metaPath = path.join(dir, 'metadata.json');
    const encPath = path.join(dir, 'storageState.enc');

    if (!fsSync.existsSync(metaPath) || !fsSync.existsSync(encPath)) {
      return null;
    }

    try {
      const metaContent = await fs.readFile(metaPath, 'utf8');
      const metadata = JSON.parse(metaContent);

      const encContent = await fs.readFile(encPath, 'utf8');
      const decrypted = this.cryptoHelper.decrypt(encContent);
      const storageState = JSON.parse(decrypted.plaintext);

      return { metadata, storageState };
    } catch (err) {
      return null;
    }
  }

  public async loadEncrypted(marketplace: string, profileId: string): Promise<{ metadata: any; storageStateEnc: string } | null> {
    const dir = path.join(this.baseDir, marketplace.toLowerCase(), profileId);
    const metaPath = path.join(dir, 'metadata.json');
    const encPath = path.join(dir, 'storageState.enc');

    if (!fsSync.existsSync(metaPath) || !fsSync.existsSync(encPath)) {
      return null;
    }

    try {
      const metaContent = await fs.readFile(metaPath, 'utf8');
      const metadata = JSON.parse(metaContent);

      const storageStateEnc = await fs.readFile(encPath, 'utf8');

      return { metadata, storageStateEnc };
    } catch (err) {
      return null;
    }
  }

  public async delete(marketplace: string, profileId: string): Promise<void> {
    const dir = path.join(this.baseDir, marketplace.toLowerCase(), profileId);
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }

  public async list(marketplace?: string): Promise<{ id: string; marketplace: string; metadata: any }[]> {
    if (!fsSync.existsSync(this.baseDir)) {
      return [];
    }

    const results: { id: string; marketplace: string; metadata: any }[] = [];

    try {
      const mkts = marketplace ? [marketplace.toLowerCase()] : await fs.readdir(this.baseDir);

      for (const mkt of mkts) {
        const mktDir = path.join(this.baseDir, mkt);
        const mktStat = await fs.stat(mktDir).catch(() => null);
        if (!mktStat || !mktStat.isDirectory()) continue;

        const profiles = await fs.readdir(mktDir);
        for (const profile of profiles) {
          const profileDir = path.join(mktDir, profile);
          const profileStat = await fs.stat(profileDir).catch(() => null);
          if (!profileStat || !profileStat.isDirectory()) continue;

          const metaPath = path.join(profileDir, 'metadata.json');
          if (fsSync.existsSync(metaPath)) {
            const metaContent = await fs.readFile(metaPath, 'utf8');
            const metadata = JSON.parse(metaContent);
            results.push({
              id: profile,
              marketplace: mkt,
              metadata
            });
          }
        }
      }
    } catch (err) {
      // Falha silenciosa
    }

    return results;
  }
}
