import { BaseAuthenticationStrategy } from './BaseAuthenticationStrategy.js';
import {
  AuthenticationCookie,
  AuthenticationEvidence,
  AuthenticationInspectionContext
} from '../../../domain/ports/IAuthenticationStrategy.js';

export class MercadoLivreAuthenticationStrategy extends BaseAuthenticationStrategy {
  public readonly strategyVersion = 1;

  public getValidationUrl(): string {
    return 'https://www.mercadolivre.com.br/';
  }

  protected async checkSessionIntegrity(context: AuthenticationInspectionContext) {
    const sessionCookieNames = ['sid', 'ssid', 'user_session', 'org_session_key'];
    const presentCookies = context.cookies.filter(c => sessionCookieNames.includes(c.name.toLowerCase()));

    const evidence: AuthenticationEvidence[] = presentCookies.map(c => ({
      type: 'cookie',
      value: c.name
    }));

    if (presentCookies.length === 0) {
      return {
        isValid: false,
        status: 'MISSING' as const,
        confidence: 1.0,
        summary: 'Authentication cookies missing.',
        reason: 'No active session cookies (sid, ssid, user_session) found for Mercado Livre.',
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

    // 1. Detect WAF / CAPTCHA
    const urlLower = context.url.toLowerCase();
    if (urlLower.includes('captcha') || urlLower.includes('validatecaptcha') || urlLower.includes('recaptcha')) {
      evidence.push({ type: 'url', value: context.url });
      return {
        detected: true,
        status: 'CAPTCHA_REQUIRED' as const,
        confidence: 1.0,
        summary: 'CAPTCHA barrier detected.',
        reason: `Mercado Livre CAPTCHA detected in URL: ${context.url}`,
        evidence
      };
    }

    // 2. Detect explicit login page URLs
    if (urlLower.includes('/login') || urlLower.includes('/signin') || urlLower.includes('account-verification')) {
      evidence.push({ type: 'url', value: context.url });
      return {
        detected: true,
        status: 'LOGIN_REQUIRED' as const,
        confidence: 1.0,
        summary: 'Login required.',
        reason: `Mercado Livre login/register page detected in URL: ${context.url}`,
        evidence
      };
    }

    // 3. Detect login form elements or buttons
    const loginFormFields = ['input[name="user_id"]', '#user_id', '#password', 'input[name="password"]'];
    for (const selector of loginFormFields) {
      if (await context.page.exists(selector)) {
        evidence.push({ type: 'selector', value: selector });
        return {
          detected: true,
          status: 'LOGIN_REQUIRED' as const,
          confidence: 0.95,
          summary: 'Login required.',
          reason: `Mercado Livre login form element detected: ${selector}`,
          evidence
        };
      }
    }

    // 4. Detect visible login link buttons in header
    const hasLoginButton = await context.page.exists('a[href*="/login"]') || await context.page.exists('a[href*="/registro"]');
    const hasUserLabel = await context.page.exists('.nav-header-username') || await context.page.exists('.nav-header-user-label');
    if (hasLoginButton && !hasUserLabel) {
      evidence.push({ type: 'selector', value: 'a[href*="/login"]' });
      return {
        detected: true,
        status: 'LOGIN_REQUIRED' as const,
        confidence: 0.95,
        summary: 'Login required.',
        reason: 'Mercado Livre login or registration links detected in header.',
        evidence
      };
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
    const usernameSelectors = ['.nav-header-username', '.nav-header-user-label'];

    for (const selector of usernameSelectors) {
      if (await context.page.exists(selector)) {
        const text = await context.page.text(selector);
        evidence.push({ type: 'selector', value: selector });
        if (text) {
          evidence.push({ type: 'text', value: text.trim() });
        }
        return {
          authenticated: true,
          confidence: 1.0,
          summary: 'Session is valid.',
          reason: `Mercado Livre user label detected: "${text ? text.trim() : ''}"`,
          evidence
        };
      }
    }

    return {
      authenticated: false,
      confidence: 0,
      reason: 'No Mercado Livre authenticated user label detected.',
      summary: 'Login required.',
      evidence
    };
  }
}
