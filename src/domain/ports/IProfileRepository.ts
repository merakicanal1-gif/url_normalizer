export interface IProfileRepository {
  save(marketplace: string, profileId: string, metadata: any, storageState: any): Promise<void>;
  load(marketplace: string, profileId: string): Promise<{ metadata: any; storageState: any } | null>;
  delete(marketplace: string, profileId: string): Promise<void>;
  list(marketplace?: string): Promise<{ id: string; marketplace: string; metadata: any }[]>;
}
