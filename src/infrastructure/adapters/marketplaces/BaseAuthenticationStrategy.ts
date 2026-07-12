import {
  IAuthenticationStrategy,
  AuthenticationStrategyResult,
  AuthenticationCookie,
  AuthenticationEvidence,
  AuthenticationInspectionContext
} from '../../../domain/ports/IAuthenticationStrategy.js';
import { IPageInspector } from '../../../domain/ports/IPageInspector.js';
import { SessionStatus } from '../../../domain/models/AuthenticationSessionStatus.js';

export abstract class BaseAuthenticationStrategy implements IAuthenticationStrategy {
  public abstract getValidationUrl(): string;
  public abstract readonly strategyVersion: number;

  protected readonly evaluationPolicy: 'COOKIES_FIRST' | 'DOM_FIRST' = 'COOKIES_FIRST';

  public async detect(pageInspector: IPageInspector): Promise<AuthenticationStrategyResult> {
    try {
      // 1. Obter URL e Cookies para compor o contexto de inspeção
      const url = await pageInspector.url();
      const rawCookies = await pageInspector.cookies();
      
      const cookies: AuthenticationCookie[] = rawCookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        secure: c.secure,
        httpOnly: c.httpOnly
      }));

      const context: AuthenticationInspectionContext = {
        page: pageInspector,
        url,
        cookies
      };

      if (this.evaluationPolicy === 'DOM_FIRST') {
        // 1. Detectar Desafios/Barreiras (WAF, CAPTCHA, Login Page)
        const challenge = await this.detectChallenges(context);
        if (challenge.detected) {
          return {
            authenticated: false,
            status: challenge.status,
            confidence: challenge.confidence,
            strategyVersion: this.strategyVersion,
            summary: challenge.summary,
            reason: challenge.reason,
            evidence: challenge.evidence
          };
        }

        // 2. Buscar Evidências Positivas (Menu do usuário, área logada)
        const positive = await this.detectPositiveSignals(context);
        if (positive.authenticated) {
          // Enriquecer evidência de cookies mesmo quando autenticado via DOM
          const integrity = await this.checkSessionIntegrity(context);
          let reason = positive.reason;
          const evidence = [...integrity.evidence, ...positive.evidence];

          if (!integrity.isValid) {
            reason = `Visual authenticated session detected. Cookie integrity degraded. Original reason: ${positive.reason}`;
            evidence.push({
              type: 'warning',
              value: 'Visual authenticated session detected. Cookie integrity degraded.'
            });
          }

          return {
            authenticated: true,
            status: 'VALID',
            confidence: positive.confidence,
            strategyVersion: this.strategyVersion,
            summary: positive.summary,
            reason,
            evidence
          };
        }

        // 3. Somente depois analisar cookies (Session Integrity)
        const integrity = await this.checkSessionIntegrity(context);
        if (!integrity.isValid) {
          return {
            authenticated: false,
            status: integrity.status ?? 'INVALID',
            confidence: integrity.confidence ?? 1.0,
            strategyVersion: this.strategyVersion,
            summary: integrity.summary ?? 'Session integrity check failed.',
            reason: integrity.reason ?? 'Required session cookies missing.',
            evidence: integrity.evidence
          };
        }

        // Fallback: Nenhum desafio ou positivo explícito encontrado
        return {
          authenticated: false,
          status: 'LOGIN_REQUIRED',
          confidence: 0.85,
          strategyVersion: this.strategyVersion,
          summary: 'Authentication required.',
          reason: 'Validation page loaded but no authenticated user signals found.',
          evidence: integrity.evidence
        };
      } else {
        // Fluxo padrão: COOKIES_FIRST
        // Etapa 1: Validar Integridade (cookies mínimos)
        const integrity = await this.checkSessionIntegrity(context);
        if (!integrity.isValid) {
          return {
            authenticated: false,
            status: integrity.status ?? 'INVALID',
            confidence: integrity.confidence ?? 1.0,
            strategyVersion: this.strategyVersion,
            summary: integrity.summary ?? 'Session integrity check failed.',
            reason: integrity.reason ?? 'Required session cookies missing.',
            evidence: integrity.evidence
          };
        }

        // Etapa 3: Detectar Desafios/Barreiras (WAF, CAPTCHA, Login Page)
        const challenge = await this.detectChallenges(context);
        if (challenge.detected) {
          return {
            authenticated: false,
            status: challenge.status,
            confidence: challenge.confidence,
            strategyVersion: this.strategyVersion,
            summary: challenge.summary,
            reason: challenge.reason,
            evidence: challenge.evidence
          };
        }

        // Etapa 4: Buscar Evidências Positivas (Menu do usuário, área logada)
        const positive = await this.detectPositiveSignals(context);
        if (positive.authenticated) {
          return {
            authenticated: true,
            status: 'VALID',
            confidence: positive.confidence,
            strategyVersion: this.strategyVersion,
            summary: positive.summary,
            reason: positive.reason,
            evidence: [...integrity.evidence, ...positive.evidence]
          };
        }

        // Etapa 5 (Fallback): Nenhum desafio ou positivo explícito encontrado
        return {
          authenticated: false,
          status: 'LOGIN_REQUIRED',
          confidence: 0.85,
          strategyVersion: this.strategyVersion,
          summary: 'Authentication required.',
          reason: 'Validation page loaded but no authenticated user signals found.',
          evidence: integrity.evidence
        };
      }

    } catch (err: any) {
      // Tratar erros sem propagar exceções
      return {
        authenticated: false,
        status: 'INVALID',
        confidence: 0,
        strategyVersion: this.strategyVersion,
        summary: 'Failed to inspect session authentication status.',
        reason: `Inspector error occurred: ${err.message}`,
        evidence: [{ type: 'error', value: err.stack || err.message }]
      };
    }
  }

  protected abstract checkSessionIntegrity(context: AuthenticationInspectionContext): Promise<{
    isValid: boolean;
    status?: 'MISSING' | 'INVALID';
    confidence?: number;
    reason?: string;
    summary?: string;
    evidence: AuthenticationEvidence[];
  }>;

  protected abstract detectChallenges(context: AuthenticationInspectionContext): Promise<{
    detected: boolean;
    status: 'CAPTCHA_REQUIRED' | 'LOGIN_REQUIRED' | 'BLOCKED' | 'INVALID';
    confidence: number;
    reason: string;
    summary: string;
    evidence: AuthenticationEvidence[];
  }>;

  protected abstract detectPositiveSignals(context: AuthenticationInspectionContext): Promise<{
    authenticated: boolean;
    confidence: number;
    reason: string;
    summary: string;
    evidence: AuthenticationEvidence[];
  }>;
}
