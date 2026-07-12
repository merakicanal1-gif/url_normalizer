import { AuthenticationRecommendedAction } from './AuthenticationRecommendedAction.js';

export type SessionStatus = 
  | 'UNKNOWN' 
  | 'VALID' 
  | 'EXPIRING' 
  | 'EXPIRED' 
  | 'LOGIN_REQUIRED'
  | 'CAPTCHA_REQUIRED' 
  | 'BLOCKED' 
  | 'LOCKED' 
  | 'INVALID' 
  | 'CORRUPTED'
  | 'MISSING' 
  | 'IMPORTED' 
  | 'RESTORED';

export interface SessionDiagnostic {
  marketplace: string;
  profileId: string;
  status: SessionStatus;
  confidence: number;
  authenticated: boolean;
  profileExists: boolean;
  storageStateExists: boolean;
  metadataExists: boolean;
  manifestExists: boolean;
  checksumValid: boolean;
  schemaCompatible: boolean;
  profileVersion: number;
  applicationVersion: string;
  gitSha: string;
  createdAt: string;
  lastAuthentication: string | null;
  lastValidation: string | null;
  lastSuccessfulNormalize: string | null;
  lastSuccessfulRefresh: string | null;
  lastFailure?: string | null;
  lastFailureReason?: string | null;
  warnings: string[];
  recommendedAction: AuthenticationRecommendedAction;
}
