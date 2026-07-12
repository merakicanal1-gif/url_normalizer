import { IAuthenticationStrategy, AuthenticationStrategyResult } from '../../../domain/ports/IAuthenticationStrategy.js';
import { IPageInspector } from '../../../domain/ports/IPageInspector.js';

export class MercadoLivreAuthenticationStrategy implements IAuthenticationStrategy {
  public getValidationUrl(): string {
    return 'https://www.mercadolivre.com.br/';
  }

  public async detect(pageInspector: IPageInspector): Promise<AuthenticationStrategyResult> {
    const url = await pageInspector.url();

    // 1. Verificar WAF/CAPTCHA por URL e conteúdo
    if (url.includes('captcha') || url.includes('validatecaptcha')) {
      return {
        authenticated: false,
        confidence: 1.0,
        reason: 'Mercado Livre CAPTCHA page detected',
        status: 'CAPTCHA_REQUIRED'
      };
    }

    // 2. Verificar URL de Login
    if (url.includes('/login') || url.includes('/signin') || url.includes('account-verification')) {
      return {
        authenticated: false,
        confidence: 1.0,
        reason: 'Mercado Livre authentication/login page detected',
        status: 'LOGIN_REQUIRED'
      };
    }

    // 3. Verificar botões de login visíveis no cabeçalho
    // No Mercado Livre, se "Entre" ou "Crie a sua conta" estiverem visíveis, a sessão não está logada
    const hasLoginLink = await pageInspector.exists('a[href*="/login"]') || await pageInspector.exists('a[href*="/registro"]');
    const hasUserLabel = await pageInspector.exists('.nav-header-username') || await pageInspector.exists('.nav-header-user-label');

    if (hasLoginLink && !hasUserLabel) {
      return {
        authenticated: false,
        confidence: 0.95,
        reason: 'Login or registration links detected in header',
        status: 'LOGIN_REQUIRED'
      };
    }

    // 4. Verificar cookies
    const cookies = await pageInspector.cookies();
    const cookieNames = cookies.map(c => c.name);
    
    // Cookies comuns de sessão do Mercado Livre (ex: sid, ssid, user_session)
    const hasSessionCookie = cookieNames.some(name => ['sid', 'ssid', 'user_session', 'org_session_key'].includes(name.toLowerCase()));

    if (hasUserLabel || hasSessionCookie) {
      return {
        authenticated: true,
        confidence: hasUserLabel && hasSessionCookie ? 1.0 : 0.95,
        reason: `User menu label (${hasUserLabel}) or session cookies (${hasSessionCookie}) detected`,
        status: 'VALID'
      };
    }

    // Fallback caso não ache sinais fortes
    return {
      authenticated: false,
      confidence: 0.50,
      reason: 'No authentication signals or user menu found',
      status: 'UNKNOWN'
    };
  }
}
