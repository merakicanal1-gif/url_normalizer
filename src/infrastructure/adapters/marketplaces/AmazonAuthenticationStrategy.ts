import { BaseAuthenticationStrategy } from './BaseAuthenticationStrategy.js';
import {
  AuthenticationCookie,
  AuthenticationEvidence,
  AuthenticationInspectionContext
} from '../../../domain/ports/IAuthenticationStrategy.js';

export class AmazonAuthenticationStrategy extends BaseAuthenticationStrategy {
  public readonly strategyVersion = 1;
  protected override readonly evaluationPolicy = 'DOM_FIRST' as const;

  public getValidationUrl(): string {
    return 'https://www.amazon.com.br/gp/css/homepage.html';
  }

  protected async checkSessionIntegrity(context: AuthenticationInspectionContext) {
    const requiredCookies = ['x-main', 'at-main', 'session-token'];
    const presentCookieNames = context.cookies.map(c => c.name);
    const missingCookies = requiredCookies.filter(name => !presentCookieNames.includes(name));

    const evidence: AuthenticationEvidence[] = context.cookies
      .filter(c => requiredCookies.includes(c.name))
      .map(c => ({ type: 'cookie', value: c.name }));

    if (missingCookies.length > 0) {
      return {
        isValid: false,
        status: 'MISSING' as const,
        confidence: 1.0,
        summary: 'Authentication cookies missing.',
        reason: `Missing required Amazon cookies: ${missingCookies.join(', ')}`,
        evidence
      };
    }

    return {
      isValid: true,
      evidence
    };
  }

  protected async detectChallenges(context: AuthenticationInspectionContext) {
    const evidence: AuthenticationEvidence[] = [];

    // 1. Detect WAF / CAPTCHA / Robot Check by URL
    const urlLower = context.url.toLowerCase();
    if (
      urlLower.includes('captcha') || 
      urlLower.includes('validatecaptcha') || 
      urlLower.includes('robotcheck') ||
      urlLower.includes('robot-check')
    ) {
      evidence.push({ type: 'url', value: context.url });
      return {
        detected: true,
        status: 'CAPTCHA_REQUIRED' as const,
        confidence: 1.0,
        summary: 'CAPTCHA barrier detected.',
        reason: `Amazon CAPTCHA or robot check detected in URL: ${context.url}`,
        evidence
      };
    }

    // 2. Detect explicit login page URLs
    if (urlLower.includes('/ap/signin') || urlLower.includes('/ap/register') || urlLower.includes('signin=')) {
      evidence.push({ type: 'url', value: context.url });
      return {
        detected: true,
        status: 'LOGIN_REQUIRED' as const,
        confidence: 1.0,
        summary: 'Login required.',
        reason: `Amazon login/register page detected in URL: ${context.url}`,
        evidence
      };
    }

    // 3. Detect login form input fields in the DOM
    const loginFormFields = ['input[name="email"]', '#ap_email', '#ap_password'];
    for (const selector of loginFormFields) {
      if (await context.page.exists(selector)) {
        evidence.push({ type: 'selector', value: selector });
        return {
          detected: true,
          status: 'LOGIN_REQUIRED' as const,
          confidence: 0.95,
          summary: 'Login required.',
          reason: `Amazon login form field detected: ${selector}`,
          evidence
        };
      }
    }

    // 4. Detect CAPTCHA element in DOM
    const captchaSelectors = ['.g-recaptcha', 'input[name="captcha"]', '#captchacharacters'];
    for (const selector of captchaSelectors) {
      if (await context.page.exists(selector)) {
        evidence.push({ type: 'selector', value: selector });
        return {
          detected: true,
          status: 'CAPTCHA_REQUIRED' as const,
          confidence: 0.95,
          summary: 'CAPTCHA barrier detected.',
          reason: `Amazon CAPTCHA element detected: ${selector}`,
          evidence
        };
      }
    }

    return {
      detected: false,
      status: 'INVALID' as const,
      confidence: 0,
      reason: '',
      summary: '',
      evidence
    };
  }

  protected async detectPositiveSignals(context: AuthenticationInspectionContext) {
    const evidence: AuthenticationEvidence[] = [];
    const accountMenuSelector = '#nav-link-accountList-nav-line-1';

    const hasAccountMenu = await context.page.exists(accountMenuSelector);
    if (hasAccountMenu) {
      const menuText = await context.page.text(accountMenuSelector);
      if (menuText) {
        const textLower = menuText.toLowerCase();
        const hasBoasVindas = ['olá,', 'olá', 'hello,', 'hello'].some(word => textLower.includes(word));
        const hasLoginWord = ['faça seu login', 'sign in', 'fazer login'].some(word => textLower.includes(word));

        if (hasBoasVindas && !hasLoginWord) {
          evidence.push({ type: 'selector', value: accountMenuSelector });
          evidence.push({ type: 'text', value: menuText.trim() });
          return {
            authenticated: true,
            confidence: 1.0,
            summary: 'Session is valid.',
            reason: `Amazon authenticated user menu detected with greeting: "${menuText.trim()}"`,
            evidence
          };
        }
      }
    }

    return {
      authenticated: false,
      confidence: 0,
      reason: 'No authenticated user menu or greeting detected.',
      summary: 'Login required.',
      evidence
    };
  }
}
