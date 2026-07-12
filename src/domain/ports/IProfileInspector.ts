import { SessionStatus } from '../models/AuthenticationSessionStatus.js';

export interface InspectionResult {
  marketplace: string;
  profileId: string;
  storageStateLoaded: boolean;
  cookiesLoaded: number;
  currentUrl: string;
  windowOpened: boolean;
  authenticated: boolean;
  detectorStatus: SessionStatus;
  confidence: number;
  detector: {
    strategy: string;
    reason: string;
    status: SessionStatus;
    confidence: number;
  };
}

export interface IProfileInspector {
  inspect(
    marketplace: string,
    profileId: string,
    customUrl?: string,
    browserType?: 'interactive' | 'worker'
  ): Promise<InspectionResult>;
}
