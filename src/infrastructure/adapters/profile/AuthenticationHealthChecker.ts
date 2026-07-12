import { IAuthenticationHealthChecker } from '../../../domain/ports/IAuthenticationHealthChecker.js';
import { IAuthenticationStrategy, AuthenticationStrategyResult } from '../../../domain/ports/IAuthenticationStrategy.js';
import { IBrowserSessionFactory } from '../../../domain/ports/IBrowserSessionFactory.js';
import { PlaywrightPageInspector } from '../browser/PlaywrightPageInspector.js';

export class AuthenticationHealthChecker implements IAuthenticationHealthChecker {
  constructor(private sessionFactory: IBrowserSessionFactory) {}

  public async checkHealth(
    marketplace: string,
    profileId: string,
    strategy: IAuthenticationStrategy
  ): Promise<AuthenticationStrategyResult> {
    const session = await this.sessionFactory.createSession(marketplace, profileId);
    try {
      const validationUrl = strategy.getValidationUrl();
      
      // Navegar para a URL leve de validação
      await session.page.goto(validationUrl, 30000);
      
      // Obter raw page e instanciar o PageInspector da infra
      const rawPage = (session.page as any).getRawPage();
      const pageInspector = new PlaywrightPageInspector(rawPage);
      
      // Delegar a verificação de login/captcha/waf para a estratégia do plugin
      const result = await strategy.detect(pageInspector);
      return result;
    } finally {
      await session.dispose().catch(() => {});
    }
  }
}
