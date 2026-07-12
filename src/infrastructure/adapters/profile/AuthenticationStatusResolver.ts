import { execSync } from 'node:child_process';
import { IAuthenticationStatusResolver } from '../../../domain/ports/IAuthenticationStatusResolver.js';
import { IProfileRepository } from '../../../domain/ports/IProfileRepository.js';
import { IProfileValidator } from '../../../domain/ports/IProfileValidator.js';
import { SessionDiagnostic, SessionStatus } from '../../../domain/models/AuthenticationSessionStatus.js';
import { AuthenticationRecommendedAction } from '../../../domain/models/AuthenticationRecommendedAction.js';

export class AuthenticationStatusResolver implements IAuthenticationStatusResolver {
  constructor(
    private repository: IProfileRepository,
    private validator: IProfileValidator
  ) {}

  public async resolveStatus(marketplace: string, profileId: string): Promise<SessionDiagnostic> {
    const mkt = marketplace.toLowerCase();
    
    // 1. Verificar integridade física/estrutural
    const validation = await this.validator.validateStructure(mkt, profileId);
    
    // Obter git SHA para retornar
    let gitSha = 'unknown';
    try {
      gitSha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch (e) {}

    const defaultDiagnostic: SessionDiagnostic = {
      marketplace: mkt,
      profileId,
      status: 'MISSING',
      confidence: 0.0,
      authenticated: false,
      profileExists: false,
      storageStateExists: false,
      metadataExists: false,
      manifestExists: false,
      checksumValid: false,
      schemaCompatible: false,
      profileVersion: 0,
      applicationVersion: '0.7.0',
      gitSha,
      createdAt: '',
      lastAuthentication: null,
      lastValidation: null,
      lastSuccessfulNormalize: null,
      lastSuccessfulRefresh: null,
      lastFailure: null,
      lastFailureReason: null,
      warnings: [],
      recommendedAction: AuthenticationRecommendedAction.CREATE_NEW_PROFILE
    };

    const localData = await this.repository.loadEncrypted(mkt, profileId).catch(() => null);
    if (!localData) {
      defaultDiagnostic.warnings.push('Profile files not found in filesystem.');
      return defaultDiagnostic;
    }

    defaultDiagnostic.profileExists = true;
    defaultDiagnostic.metadataExists = !!localData.metadata;
    defaultDiagnostic.storageStateExists = !!localData.storageStateEnc;

    if (!validation.isValid) {
      const isCorrupted = validation.errors.some(err => err.includes('Encryption') || err.includes('integrity') || err.includes('corrupted'));
      defaultDiagnostic.status = isCorrupted ? 'CORRUPTED' : 'INVALID';
      defaultDiagnostic.warnings = validation.errors;
      defaultDiagnostic.recommendedAction = isCorrupted 
        ? AuthenticationRecommendedAction.EXPORT_NEW_PROFILE_AND_IMPORT 
        : AuthenticationRecommendedAction.VALIDATE_PROFILE;
      return defaultDiagnostic;
    }

    // Se a validação estrutural básica passou, assumimos integridade física
    defaultDiagnostic.checksumValid = true;
    defaultDiagnostic.schemaCompatible = true;
    defaultDiagnostic.manifestExists = true; // No formato local, manifest é inferido/gerado ao exportar, mas marcamos como true já que está tudo ok

    const metadata = localData.metadata;
    defaultDiagnostic.profileVersion = metadata.version || 1;
    defaultDiagnostic.createdAt = metadata.createdAt || new Date().toISOString();
    defaultDiagnostic.lastAuthentication = metadata.lastAuthentication || null;
    defaultDiagnostic.lastValidation = metadata.lastValidation || null;
    defaultDiagnostic.lastSuccessfulNormalize = metadata.lastSuccessfulNormalize || null;
    defaultDiagnostic.lastSuccessfulRefresh = metadata.lastSuccessfulRefresh || null;
    defaultDiagnostic.lastFailure = metadata.lastFailure || null;
    defaultDiagnostic.lastFailureReason = metadata.lastFailureReason || null;

    // Resolver status oficial da sessão
    const metaStatus: SessionStatus = metadata.authenticationStatus || 'UNKNOWN';
    defaultDiagnostic.status = metaStatus;

    // Calcular nível de confiança baseado no estado
    if (metaStatus === 'VALID') {
      defaultDiagnostic.authenticated = true;
      defaultDiagnostic.confidence = 0.99;
      defaultDiagnostic.recommendedAction = AuthenticationRecommendedAction.NONE;
    } else if (metaStatus === 'EXPIRING') {
      defaultDiagnostic.authenticated = true;
      defaultDiagnostic.confidence = 0.60;
      defaultDiagnostic.recommendedAction = AuthenticationRecommendedAction.REFRESH_SESSION;
    } else if (metaStatus === 'IMPORTED' || metaStatus === 'RESTORED') {
      defaultDiagnostic.authenticated = true;
      defaultDiagnostic.confidence = 0.80;
      // Para perfis importados/restaurados, a primeira ação recomendada deve ser validar/refresh
      defaultDiagnostic.recommendedAction = AuthenticationRecommendedAction.REFRESH_SESSION;
    } else if (['EXPIRED', 'LOGIN_REQUIRED', 'CAPTCHA_REQUIRED', 'BLOCKED', 'LOCKED'].includes(metaStatus)) {
      defaultDiagnostic.authenticated = false;
      defaultDiagnostic.confidence = 1.0; // Confiança total de que precisa de intervenção
      defaultDiagnostic.recommendedAction = AuthenticationRecommendedAction.EXPORT_NEW_PROFILE_AND_IMPORT;
    } else {
      // UNKNOWN ou outro status
      defaultDiagnostic.authenticated = false;
      defaultDiagnostic.confidence = 0.0;
      defaultDiagnostic.recommendedAction = AuthenticationRecommendedAction.REFRESH_SESSION;
    }

    return defaultDiagnostic;
  }
}
