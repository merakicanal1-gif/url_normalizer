import { IAuthenticationStrategy } from './IAuthenticationStrategy.js';
import { AuthenticationStrategyResult } from './IAuthenticationStrategy.js';

export interface IAuthenticationHealthChecker {
  checkHealth(
    marketplace: string,
    profileId: string,
    strategy: IAuthenticationStrategy
  ): Promise<AuthenticationStrategyResult>;
}
