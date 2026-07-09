import { INavigatorPage } from './INavigator.js';

export interface ResolutionMetadata {
  resolver: string;
  strategy: 'http' | 'browser' | 'none';
  redirectCount: number;
  durationMs: number;
  usedBrowser: boolean;
  usedHttp: boolean;
  fallbackOccurred: boolean;
  error?: string;
}

export interface ResolvedUrl {
  originalUrl: string;
  finalUrl: string;
  statusCode: number | null;
  pageTitle: string;
  detectedChallenge: boolean;
  detectedCaptcha: boolean;
  detectedConsent: boolean;
  detectedLogin: boolean;
  challengeType?: 'CAPTCHA' | 'WAF' | 'CONSENT' | 'LOGIN' | 'UNKNOWN';
  page?: INavigatorPage; // Mantém a página aberta para reuso opcional na extração
  outcome: 'RESOLVED' | 'CONTINUE' | 'STOP';
  metadata: ResolutionMetadata;
}

export interface IUrlResolver {
  canResolve(url: URL): boolean;
  resolve(url: URL, timeoutMs?: number, profileId?: string): Promise<ResolvedUrl>;
}
