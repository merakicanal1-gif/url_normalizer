import { IPageInspector } from './IPageInspector.js';
import { SessionStatus } from '../models/AuthenticationSessionStatus.js';

export interface AuthenticationCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  secure: boolean;
  httpOnly: boolean;
}

export interface AuthenticationEvidence {
  type: 'cookie' | 'selector' | 'url' | 'text' | 'challenge' | 'redirect' | 'error' | 'warning';
  value: string;
}

export interface AuthenticationInspectionContext {
  page: IPageInspector;
  url: string;
  cookies: AuthenticationCookie[];
}

export interface AuthenticationStrategyResult {
  authenticated: boolean;
  status: SessionStatus;
  confidence: number;
  strategyVersion: number;
  summary: string;
  reason: string;
  evidence: AuthenticationEvidence[];
}

export interface IAuthenticationStrategy {
  getValidationUrl(): string;
  detect(pageInspector: IPageInspector): Promise<AuthenticationStrategyResult>;
}
