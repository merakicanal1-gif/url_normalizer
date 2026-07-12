import { BaseAuthenticationStrategy } from './BaseAuthenticationStrategy.js';
import {
  AuthenticationCookie,
  AuthenticationEvidence,
  AuthenticationInspectionContext
} from '../../../domain/ports/IAuthenticationStrategy.js';

export class ShopeeAuthenticationStrategy extends BaseAuthenticationStrategy {
  public readonly strategyVersion = 1;

  public getValidationUrl(): string {
    return 'https://shopee.com.br/';
  }

  protected async checkSessionIntegrity(context: AuthenticationInspectionContext) {
    const sessionCookieNames = ['shopee_token', 'spc_ec', 'spc_u', 'spc_t'];
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
        reason: 'No Shopee session cookies (shopee_token, SPC_EC) found.',
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
    if (urlLower.includes('captcha') || urlLower.includes('security-check') || urlLower.includes('challenge')) {
      evidence.push({ type: 'url', value: context.url });
      return {
        detected: true,
        status: 'CAPTCHA_REQUIRED' as const,
        confidence: 1.0,
        summary: 'CAPTCHA barrier detected.',
        reason: `Shopee CAPTCHA or security verification detected in URL: ${context.url}`,
        evidence
      };
    }

    // 2. Detect explicit login page URLs
    if (urlLower.includes('/login') || urlLower.includes('/signup')) {
      evidence.push({ type: 'url', value: context.url });
      return {
        detected: true,
        status: 'LOGIN_REQUIRED' as const,
        confidence: 1.0,
        summary: 'Login required.',
        reason: `Shopee login page detected in URL: ${context.url}`,
        evidence
      };
    }

    // 3. Detect login form elements
    const loginFormFields = ['input[placeholder*="Telefone"]', 'input[type="password"]', '.shopee-input'];
    for (const selector of loginFormFields) {
      if (await context.page.exists(selector)) {
        evidence.push({ type: 'selector', value: selector });
        return {
          detected: true,
          status: 'LOGIN_REQUIRED' as const,
          confidence: 0.90,
          summary: 'Login required.',
          reason: `Shopee login input field detected: ${selector}`,
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
    const usernameSelectors = ['.navbar__username', '.navbar__link--account'];

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
          reason: `Shopee authenticated user label detected: "${text ? text.trim() : ''}"`,
          evidence
        };
      }
    }

    return {
      authenticated: false,
      confidence: 0,
      reason: 'No Shopee authenticated username detected.',
      summary: 'Login required.',
      evidence
    };
  }
}
