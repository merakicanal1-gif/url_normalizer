export interface ProfileManifest {
  profileFormatVersion: number;
  applicationVersion: string;
  gitSha: string;
  marketplace: string;
  profileId: string;
  profileVersion: number;
  createdAt: string;
  exportedAt: string;
  browserEngine: string;
  browserVersion: string;
  nodeVersion: string;
  osPlatform: string;
  checksum: string;
  hashAlgorithm: string;
  encryptionVersion: string;
}

export interface ProfilePackage {
  manifest: ProfileManifest;
  metadata: any;
  storageStateEnc: string;
}
