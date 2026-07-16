export interface IProfileRepository {
  save(marketplace: string, profileId: string, metadata: any, storageState: any, options?: { force?: boolean }): Promise<void>;
  saveEncrypted(marketplace: string, profileId: string, metadata: any, storageStateEnc: string, options?: { force?: boolean }): Promise<void>;
  load(marketplace: string, profileId: string): Promise<{ metadata: any; storageState: any } | null>;
  loadEncrypted(marketplace: string, profileId: string): Promise<{ metadata: any; storageStateEnc: string } | null>;
  delete(marketplace: string, profileId: string): Promise<void>;
  list(marketplace?: string): Promise<{ id: string; marketplace: string; metadata: any }[]>;
  loadMetadata(marketplace: string, profileId: string): Promise<any | null>;
  saveMetadata(marketplace: string, profileId: string, metadata: any, options?: { force?: boolean }): Promise<void>;
}
