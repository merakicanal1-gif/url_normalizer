import { IPageInspector } from './IPageInspector.js';

export interface AuthenticationDetectionResult {
  authenticated: boolean;
  confidence: number;
  reason: string;
}

export interface AuthenticationDetectionContext {
  marketplace: string;
  pageInspector: IPageInspector;
  startedAt: string;
  sessionId: string;
  profileId: string;
  requestId: string;
  traceId: string;
}

export interface IAuthenticationDetector {
  detect(context: AuthenticationDetectionContext): Promise<AuthenticationDetectionResult>;
}
