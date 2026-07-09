export type SessionStatus = 'CREATED' | 'PROVISIONING' | 'ACTIVE' | 'EXPIRED' | 'INVALID' | 'ERROR' | 'DISABLED' | 'LOCKED';

export interface SessionMetadata {
  lastLogin: string | null;
  lastSuccess: string | null;
  lastFailure: string | null;
  validationCount: number;
  failureCount: number;
  lastMarketplaceResponse: string;
  lastValidation: string | null;
  createdBy: string;
  profileVersion: number;
}

export interface SessionTimestamps {
  createdAt: string;
  updatedAt: string;
}

export interface SessionProfile {
  id: string;
  status: SessionStatus;
  storageState: any; // Cookies and localStorage JSON structure from Playwright
  metadata: SessionMetadata;
  timestamps: SessionTimestamps;
}

export interface MarketplaceSession {
  marketplace: string;
  profiles: SessionProfile[];
}
