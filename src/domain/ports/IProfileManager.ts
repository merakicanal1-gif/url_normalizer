export interface IProfileManager {
  getProfile(marketplace: string, profileId: string): Promise<any | null>;
  createProfile(marketplace: string, profileId: string, createdBy?: string): Promise<any>;
  saveProfileState(marketplace: string, profileId: string, storageState: any, browserVersion?: string): Promise<void>;
  deleteProfile(marketplace: string, profileId: string): Promise<void>;
  listProfiles(marketplace?: string): Promise<any[]>;
  validateProfile(marketplace: string, profileId: string): Promise<boolean>;
  importProfile(marketplace: string, profile: any): Promise<void>;
  importStorageState(marketplace: string, profileId: string, storageState: any): Promise<{ profileVersion: number; importedAt: string }>;
  loadStorageState(marketplace: string, profileId: string): Promise<any | null>;
}
