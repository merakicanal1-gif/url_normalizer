import { IAuthenticationDetector, AuthenticationDetectionContext, AuthenticationDetectionResult } from '../../../domain/ports/IAuthenticationDetector.js';
import { AmazonAuthenticationConfig } from './AmazonAuthenticationConfig.js';

export class AmazonAuthenticationDetector implements IAuthenticationDetector {
  public async detect(context: AuthenticationDetectionContext): Promise<AuthenticationDetectionResult> {
    const url = await context.pageInspector.url();

    // 1. Verificar se está explicitamente em uma URL de login/registro
    const isLoginUrl = AmazonAuthenticationConfig.urls.loginKeywords.some(keyword => url.toLowerCase().includes(keyword.toLowerCase()));
    if (isLoginUrl) {
      return {
        authenticated: false,
        confidence: 1.0,
        reason: 'On Amazon login or registration page'
      };
    }

    // 2. Verificar se campos do formulário de login estão visíveis na página
    for (const selector of AmazonAuthenticationConfig.selectors.loginFormFields) {
      if (await context.pageInspector.exists(selector)) {
        return {
          authenticated: false,
          confidence: 0.95,
          reason: 'Login form input fields detected'
        };
      }
    }

    // 3. Verificar Cookies de Autenticação
    const cookies = await context.pageInspector.cookies();
    const cookieNames = cookies.map(c => c.name);
    const presentRequiredCookies = AmazonAuthenticationConfig.cookies.required.filter(name => cookieNames.includes(name));
    const hasAllRequiredCookies = presentRequiredCookies.length === AmazonAuthenticationConfig.cookies.required.length;

    // 4. Verificar Elemento de Menu Autenticado
    let isMenuAuthenticated = false;
    let menuText: string | null = null;
    const hasAccountMenu = await context.pageInspector.exists(AmazonAuthenticationConfig.selectors.accountMenu);
    if (hasAccountMenu) {
      menuText = await context.pageInspector.text(AmazonAuthenticationConfig.selectors.accountMenu);
      if (menuText) {
        const hasAuthWord = AmazonAuthenticationConfig.texts.authenticatedMenuKeywords.some(word => menuText!.toLowerCase().includes(word.toLowerCase()));
        const hasNonAuthWord = AmazonAuthenticationConfig.texts.nonAuthenticatedKeywords.some(word => menuText!.toLowerCase().includes(word.toLowerCase()));
        if (hasAuthWord && !hasNonAuthWord) {
          isMenuAuthenticated = true;
        }
      }
    }

    // 5. Compilação da Confiança e Resultado
    if (hasAllRequiredCookies && isMenuAuthenticated) {
      return {
        authenticated: true,
        confidence: 1.0,
        reason: 'Required authentication cookies and authenticated user menu detected'
      };
    }

    if (hasAllRequiredCookies) {
      return {
        authenticated: true,
        confidence: 0.95,
        reason: 'Required authentication cookies (x-main/at-main/session-token) detected'
      };
    }

    if (presentRequiredCookies.length > 0) {
      return {
        authenticated: false,
        confidence: 0.30,
        reason: `Partial authentication cookies detected: ${presentRequiredCookies.join(', ')}`
      };
    }

    return {
      authenticated: false,
      confidence: 0.0,
      reason: 'No authentication signals or cookies detected'
    };
  }
}
