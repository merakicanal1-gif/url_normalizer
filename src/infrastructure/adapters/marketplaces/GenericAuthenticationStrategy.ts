import { IAuthenticationStrategy, AuthenticationStrategyResult } from '../../../domain/ports/IAuthenticationStrategy.js';
import { IPageInspector } from '../../../domain/ports/IPageInspector.js';

export class GenericAuthenticationStrategy implements IAuthenticationStrategy {
  public getValidationUrl(): string {
    return 'about:blank';
  }

  public async detect(pageInspector: IPageInspector): Promise<AuthenticationStrategyResult> {
    return {
      authenticated: false,
      confidence: 0.0,
      reason: 'Generic marketplace does not support authentication',
      status: 'UNKNOWN'
    };
  }
}
