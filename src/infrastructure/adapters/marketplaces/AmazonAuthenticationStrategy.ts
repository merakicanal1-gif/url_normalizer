import { IAuthenticationStrategy, AuthenticationStrategyResult } from '../../../domain/ports/IAuthenticationStrategy.js';
import { IPageInspector } from '../../../domain/ports/IPageInspector.js';
import { AmazonAuthenticationDetector } from './AmazonAuthenticationDetector.js';

export class AmazonAuthenticationStrategy implements IAuthenticationStrategy {
  private detector = new AmazonAuthenticationDetector();

  public getValidationUrl(): string {
    return 'https://www.amazon.com.br/gp/css/homepage.html';
  }

  public async detect(pageInspector: IPageInspector): Promise<AuthenticationStrategyResult> {
    const result = await this.detector.detect({
      marketplace: 'amazon',
      pageInspector,
      startedAt: new Date().toISOString(),
      sessionId: 'health-check',
      profileId: 'health-check',
      requestId: 'health-check',
      traceId: 'health-check'
    });

    // Se estiver explicitamente na página de login, definir status adequado
    let status = result.authenticated ? 'VALID' as const : 'LOGIN_REQUIRED' as const;
    if (!result.authenticated && result.reason.includes('login')) {
      status = 'LOGIN_REQUIRED' as const;
    }

    return {
      authenticated: result.authenticated,
      confidence: result.confidence,
      reason: result.reason,
      status
    };
  }
}
