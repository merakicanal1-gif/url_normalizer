import { IPageInspector } from './IPageInspector.js';
import { SessionStatus } from '../models/AuthenticationSessionStatus.js';

export interface AuthenticationStrategyResult {
  authenticated: boolean;
  confidence: number;
  reason: string;
  status: SessionStatus;
}

export interface IAuthenticationStrategy {
  getValidationUrl(): string;
  detect(pageInspector: IPageInspector): Promise<AuthenticationStrategyResult>;
}
