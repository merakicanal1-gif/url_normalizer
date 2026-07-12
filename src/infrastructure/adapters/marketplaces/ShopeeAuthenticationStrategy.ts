import { IAuthenticationStrategy, AuthenticationStrategyResult } from '../../../domain/ports/IAuthenticationStrategy.js';
import { IPageInspector } from '../../../domain/ports/IPageInspector.js';

export class ShopeeAuthenticationStrategy implements IAuthenticationStrategy {
  public getValidationUrl(): string {
    return 'https://shopee.com.br/';
  }

  public async detect(pageInspector: IPageInspector): Promise<AuthenticationStrategyResult> {
    return {
      authenticated: false,
      confidence: 0.0,
      reason: 'Shopee authentication validation not fully implemented',
      status: 'UNKNOWN'
    };
  }
}
