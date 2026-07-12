import { BaseAuthenticationStrategy } from './BaseAuthenticationStrategy.js';
import {
  AuthenticationCookie,
  AuthenticationEvidence,
  AuthenticationInspectionContext
} from '../../../domain/ports/IAuthenticationStrategy.js';

export class GenericAuthenticationStrategy extends BaseAuthenticationStrategy {
  public readonly strategyVersion = 1;

  public getValidationUrl(): string {
    return 'about:blank';
  }

  protected async checkSessionIntegrity(context: AuthenticationInspectionContext) {
    return {
      isValid: false,
      status: 'INVALID' as const,
      confidence: 0.0,
      summary: 'Authentication not supported.',
      reason: 'Generic marketplace does not support session authentication.',
      evidence: []
    };
  }

  protected async detectChallenges(context: AuthenticationInspectionContext) {
    return {
      detected: true,
      status: 'INVALID' as const,
      confidence: 0.0,
      summary: 'Authentication not supported.',
      reason: 'Generic marketplace does not support session authentication.',
      evidence: []
    };
  }

  protected async detectPositiveSignals(context: AuthenticationInspectionContext) {
    return {
      authenticated: false,
      confidence: 0.0,
      reason: 'Generic marketplace does not support session authentication.',
      summary: 'Authentication not supported.',
      evidence: []
    };
  }
}
