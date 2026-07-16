import test from 'node:test';
import assert from 'node:assert';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { SecureCryptoHelper } from '../../infrastructure/adapters/session/SecureCryptoHelper.js';
import { LocalFileProfileRepository } from '../../infrastructure/adapters/session/LocalFileProfileRepository.js';
import { MemorySessionLockManager } from '../../infrastructure/adapters/session/MemorySessionLockManager.js';
import { ProfileManager } from './ProfileManager.js';
import { EncryptedProfileExporter } from '../../infrastructure/adapters/profile/EncryptedProfileExporter.js';
import { EncryptedProfileImporter } from '../../infrastructure/adapters/profile/EncryptedProfileImporter.js';
import { ProfileIntegrityValidator } from '../../infrastructure/adapters/profile/ProfileIntegrityValidator.js';
import { ProfileExportService } from './ProfileExportService.js';
import { ProfileImportService } from './ProfileImportService.js';
import { ProfileValidationService } from './ProfileValidationService.js';
import { AuthenticationSessionService } from './AuthenticationSessionService.js';
import { AuthenticationStatusResolver } from '../../infrastructure/adapters/profile/AuthenticationStatusResolver.js';
import { AuthenticationSessionManager } from '../../infrastructure/adapters/profile/AuthenticationSessionManager.js';
import { AmazonAuthenticationStrategy } from '../../infrastructure/adapters/marketplaces/AmazonAuthenticationStrategy.js';
import { MercadoLivreAuthenticationStrategy } from '../../infrastructure/adapters/marketplaces/MercadoLivreAuthenticationStrategy.js';
import { AuthenticationRecommendedAction } from '../../domain/models/AuthenticationRecommendedAction.js';
import { IPageInspector, Cookie } from '../../domain/ports/IPageInspector.js';
import { IApplicationEventBus, ApplicationEvent } from '../../domain/ports/IApplicationEventBus.js';
import { ChallengeDetectedError } from '../../domain/errors/ChallengeDetectedError.js';
import { PlaywrightProfileInspector } from '../../infrastructure/adapters/profile/PlaywrightProfileInspector.js';
import { BrowserProfile } from '../../domain/models/BrowserProfile.js';
import { NormalizeService } from './NormalizeService.js';
import { MarketplaceRegistry } from '../registry/MarketplaceRegistry.js';

class MockPageInspector implements IPageInspector {
  constructor(
    private currentUrl: string,
    private currentCookies: Cookie[],
    private visibleSelectors: string[] = [],
    private textContent: Record<string, string> = {}
  ) {}

  public async url(): Promise<string> {
    return this.currentUrl;
  }

  public async cookies(): Promise<Cookie[]> {
    return this.currentCookies;
  }

  public async text(selector: string): Promise<string | null> {
    return this.textContent[selector] || null;
  }

  public async exists(selector: string): Promise<boolean> {
    return this.visibleSelectors.includes(selector);
  }
}

test('Subsistema de Perfis e Sessões - Testes Unitários e Integração', async (t) => {
  const tmpDir = path.join(process.cwd(), 'data', 'test-profile-subsystem');
  const cryptoHelper = new SecureCryptoHelper('test-key:secret-prod-env-key-for-subsystem');
  const repository = new LocalFileProfileRepository(cryptoHelper, tmpDir);
  const lockManager = new MemorySessionLockManager();
  
  const publishedEvents: ApplicationEvent[] = [];
  const eventBus: IApplicationEventBus = {
    publish: (evt) => { publishedEvents.push(evt); },
    subscribe: () => () => {}
  };

  const profileManager = new ProfileManager(repository, lockManager, { info: () => {}, error: () => {} }, eventBus);
  const validator = new ProfileIntegrityValidator(repository, cryptoHelper);
  const exporter = new EncryptedProfileExporter(repository);
  const importer = new EncryptedProfileImporter(repository);
  const sessionManager = new AuthenticationSessionManager(repository, lockManager);
  const statusResolver = new AuthenticationStatusResolver(repository, validator);

  const exportService = new ProfileExportService(exporter);
  const importService = new ProfileImportService(importer, validator);
  const validationService = new ProfileValidationService(validator);
  const sessionService = new AuthenticationSessionService(statusResolver);

  t.after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  await t.test('1. Estratégia de Autenticação - Amazon', async () => {
    const strategy = new AmazonAuthenticationStrategy();
    assert.strictEqual(strategy.getValidationUrl(), 'https://www.amazon.com.br/gp/css/homepage.html');

    // Cenário: Logado
    const loggedInInspector = new MockPageInspector(
      'https://www.amazon.com.br/gp/css/homepage.html',
      [
        { name: 'x-main', value: '1', domain: 'amazon', path: '/', expires: 0, httpOnly: false, secure: true, sameSite: 'Lax' },
        { name: 'at-main', value: '2', domain: 'amazon', path: '/', expires: 0, httpOnly: true, secure: true, sameSite: 'Lax' },
        { name: 'session-token', value: '3', domain: 'amazon', path: '/', expires: 0, httpOnly: true, secure: true, sameSite: 'Lax' }
      ],
      ['#nav-link-accountList-nav-line-1'],
      { '#nav-link-accountList-nav-line-1': 'Olá, Emerson' }
    );
    const resultLog = await strategy.detect(loggedInInspector);
    assert.strictEqual(resultLog.authenticated, true);
    assert.strictEqual(resultLog.status, 'VALID');
    assert.strictEqual(resultLog.confidence, 1.0);

    // Cenário: Não Logado (Tela de Login)
    const loginInspector = new MockPageInspector(
      'https://www.amazon.com.br/ap/signin',
      [],
      ['input[name="email"]']
    );
    const resultLogin = await strategy.detect(loginInspector);
    assert.strictEqual(resultLogin.authenticated, false);
    assert.strictEqual(resultLogin.status, 'LOGIN_REQUIRED');
  });

  await t.test('2. Estratégia de Autenticação - Mercado Livre', async () => {
    const strategy = new MercadoLivreAuthenticationStrategy();
    assert.strictEqual(strategy.getValidationUrl(), 'https://www.mercadolivre.com.br/');

    // Cenário: Logado
    const loggedInInspector = new MockPageInspector(
      'https://www.mercadolivre.com.br/',
      [{ name: 'sid', value: '123', domain: 'mercadolivre', path: '/', expires: 0, httpOnly: true, secure: true, sameSite: 'Lax' }],
      ['.nav-header-username']
    );
    const resultLog = await strategy.detect(loggedInInspector);
    assert.strictEqual(resultLog.authenticated, true);
    assert.strictEqual(resultLog.status, 'VALID');

    // Cenário: Não Logado
    const loggedOutInspector = new MockPageInspector(
      'https://www.mercadolivre.com.br/',
      [],
      ['a[href*="/login"]']
    );
    const resultLogOut = await strategy.detect(loggedOutInspector);
    assert.strictEqual(resultLogOut.authenticated, false);
    assert.strictEqual(resultLogOut.status, 'MISSING');
  });

  await t.test('3. Exportação e Importação - Fluxo Feliz (.profile)', async () => {
    const marketplace = 'amazon';
    const profileId = 'test-export-import';

    // Iniciar criando perfil local
    await profileManager.createProfile(marketplace, profileId, 'unit-test');

    // Injetar dados de storageState simulado
    const testStorageState = { cookies: [{ name: 'auth-cookie', value: 'secret' }], origins: [] };
    await profileManager.saveProfileState(marketplace, profileId, testStorageState, 'Chrome/120.0');

    // Atualizar status para VALID
    await sessionManager.updateValidation(marketplace, profileId, 'VALID');

    // Exportar via exportService
    const buffer = await exportService.exportProfile(marketplace, profileId);
    assert.ok(buffer);
    assert.ok(buffer.length > 0);

    // Deletar perfil local
    await profileManager.deleteProfile(marketplace, profileId);
    const deletedDiag = await sessionService.getDiagnostic(marketplace, profileId);
    assert.strictEqual(deletedDiag.profileExists, false);
    assert.strictEqual(deletedDiag.status, 'MISSING');

    // Importar via importService
    const importResult = await importService.importProfile(buffer);
    assert.strictEqual(importResult.marketplace, marketplace);
    assert.strictEqual(importResult.profileId, profileId);

    // Verificar se o perfil local foi restaurado e se metadados de importação existem
    const restoredDiag = await sessionService.getDiagnostic(marketplace, profileId);
    assert.strictEqual(restoredDiag.profileExists, true);
    assert.strictEqual(restoredDiag.status, 'IMPORTED');
    assert.ok(restoredDiag.lastSuccessfulNormalize === null);

    // Verificar se a sessão é compatível de carregar de volta
    const loadedState = await profileManager.loadStorageState(marketplace, profileId);
    assert.deepEqual(loadedState, testStorageState);
  });

  await t.test('4. Validação e Detecção de Corrupção no Pacote', async () => {
    // 4.1 Validação com Pacote Inválido (Checksum errado)
    const invalidPkg = {
      manifest: {
        profileFormatVersion: 1,
        applicationVersion: '0.7.0',
        gitSha: '123',
        marketplace: 'amazon',
        profileId: 'bad-pkg',
        profileVersion: 1,
        createdAt: new Date().toISOString(),
        exportedAt: new Date().toISOString(),
        browserEngine: 'playwright',
        browserVersion: '1.0',
        nodeVersion: 'v18',
        osPlatform: 'linux',
        checksum: 'wrong-checksum-here',
        hashAlgorithm: 'sha256',
        encryptionVersion: 'aes-256-gcm'
      },
      metadata: { version: 1 },
      storageStateEnc: JSON.stringify({ keyId: 'default', iv: '123', authTag: '456', ciphertext: '789' })
    };

    const valResult = await validator.validatePackage(invalidPkg);
    assert.strictEqual(valResult.isValid, false);
    assert.ok(valResult.errors.some(err => err.includes('Checksum mismatch') || err.includes('Decryption failed')));
  });

  await t.test('5. Integração E2E - Normalize com erro de Login e Resposta para n8n', async () => {
    const marketplace = 'amazon';
    const profileId = 'e2e-n8n-test';

    // 1. Criar perfil
    await profileManager.createProfile(marketplace, profileId, 'e2e');
    const testStorageState = { cookies: [], origins: [] };
    await profileManager.saveProfileState(marketplace, profileId, testStorageState, 'Chrome/120');
    await sessionManager.updateValidation(marketplace, profileId, 'VALID');

    // 2. Mock de plugins e resolvers de normalize
    const mockResolver = {
      canResolve: () => true,
      resolve: async (url: URL) => ({
        originalUrl: url.toString(),
        finalUrl: url.toString(),
        statusCode: 200,
        pageTitle: '',
        detectedChallenge: false,
        detectedCaptcha: false,
        detectedConsent: false,
        detectedLogin: false,
        outcome: 'RESOLVED' as const,
        metadata: { resolver: 'DirectResolver', strategy: 'none' as const, redirectCount: 0, durationMs: 0, usedBrowser: false, usedHttp: false, fallbackOccurred: false }
      })
    };

    const mockRegistry = new MarketplaceRegistry();
    const mockFailingPlugin = {
      canHandle: (url: URL) => url.hostname.includes('amazon'),
      getMarketplaceName: () => 'amazon',
      getInteractiveEntryUrl: () => 'https://signin',
      getAuthenticationStrategy: () => new AmazonAuthenticationStrategy(),
      normalize: async () => {
        // Simular que o plugin detectou LOGIN_PAGE
        throw new ChallengeDetectedError('Interactive login challenge detected', 'LOGIN');
      }
    };
    mockRegistry.register(mockFailingPlugin);

    const mockSessionFactory = {
      createSession: async () => ({
        page: {
          goto: async () => {},
          getFinalUrl: () => 'https://www.amazon.com.br/dp/B0CX123456'
        } as any,
        dispose: async () => {}
      }),
      createInteractiveSession: async () => (null as any)
    };

    const normalizeService = new NormalizeService(
      mockResolver,
      mockRegistry,
      mockSessionFactory,
      eventBus,
      sessionManager
    );

    // 3. Executar normalização que falha devido ao LOGIN_PAGE
    await assert.rejects(
      () => normalizeService.normalize('https://www.amazon.com.br/dp/B0CX123456', profileId),
      /Interactive login challenge/
    );

    // 4. Verificar se o status local da sessão foi atualizado para LOGIN_REQUIRED
    const currentDiag = await sessionService.getDiagnostic(marketplace, profileId);
    assert.strictEqual(currentDiag.status, 'LOGIN_REQUIRED');
    assert.strictEqual(currentDiag.recommendedAction, AuthenticationRecommendedAction.EXPORT_NEW_PROFILE_AND_IMPORT);
    assert.ok(currentDiag.lastFailureReason?.includes('Interactive login challenge'));

    // 5. Verificar publicação dos eventos NORMALIZE e SESSION_EXPIRED / LOGIN_REQUIRED
    const expiredEvent = publishedEvents.find(evt => evt.event === 'SESSION_EXPIRED');
    assert.ok(expiredEvent);
    assert.strictEqual(expiredEvent.profileId, profileId);

    const usedEvent = publishedEvents.find(evt => evt.event === 'PROFILE_USED');
    assert.ok(usedEvent);
    assert.strictEqual(usedEvent.profileId, profileId);
  });

  await t.test('6. Profile Inspector (PlaywrightProfileInspector) - Teste Unitário com Mocks', async (sub) => {
    const mockPage = {
      url: () => 'https://www.amazon.com.br/gp/css/homepage.html',
      title: async () => 'Amazon Product Title',
      waitForLoadState: async () => {},
      goto: async () => 'https://www.amazon.com.br/gp/css/homepage.html',
      context: () => ({
        cookies: async () => []
      })
    };
    
    const mockContext = {
      newPage: async () => mockPage,
      close: async () => {}
    };

    const mockBrowser = {
      newContext: async () => mockContext
    };

    const mockBrowserRuntime = {
      getInteractiveBrowser: () => mockBrowser,
      getWorkerBrowser: () => mockBrowser
    } as any;

    const mockContextFactory = {
      createAuthenticatedContext: async () => mockContext,
      createAnonymousContext: async () => mockContext,
      disposeContext: async () => {}
    } as any;

    const mockProfile: BrowserProfile = {
      locale: 'pt-BR',
      userAgent: 'agent',
      timezoneId: 'UTC',
      viewport: { width: 100, height: 100 },
      javaScriptEnabled: true
    };

    const mockRegistry = new MarketplaceRegistry();
    const mockPlugin = {
      canHandle: (url: URL) => url.hostname.includes('amazon'),
      getMarketplaceName: () => 'amazon',
      getInteractiveEntryUrl: () => 'https://signin',
      getAuthenticationStrategy: () => new AmazonAuthenticationStrategy(),
      normalize: async () => ({} as any)
    };
    mockRegistry.register(mockPlugin);

    const inspector = new PlaywrightProfileInspector(
      mockBrowserRuntime,
      repository,
      mockContextFactory,
      cryptoHelper,
      mockRegistry,
      mockProfile,
      { info: () => {}, error: () => {} }
    );

    // Salvar um perfil válido na base para podermos abri-lo
    const mkt = 'amazon';
    const profileId = 'test-inspector';
    await profileManager.createProfile(mkt, profileId, 'test-inspector');
    await profileManager.saveProfileState(mkt, profileId, { cookies: [{ name: 'test', value: '1', domain: 'amazon.com.br' }] });

    // Executar inspect
    const result = await inspector.inspect(mkt, profileId, 'https://www.amazon.com.br/gp/css/homepage.html', 'interactive');

    assert.strictEqual(result.marketplace, mkt);
    assert.strictEqual(result.profileId, profileId);
    assert.strictEqual(result.storageStateLoaded, true);
    assert.strictEqual(result.cookiesLoaded, 1);
    assert.strictEqual(result.windowOpened, true);
    assert.strictEqual(result.authenticated, false); // dependendo do detector mock
    assert.strictEqual(result.detector.strategy, 'AmazonAuthenticationStrategy');
  });

  await t.test('7. Escrita Atômica (Safe Write) e Validação de Conteúdo', async () => {
    const mkt = 'amazon';
    const profileId = 'safe-write-test';
    
    // Criar perfil inicial
    await profileManager.createProfile(mkt, profileId, 'test-system');
    
    // Tentar gravar um storageState criptografado corrompido/inválido (deve falhar na validação antes do rename)
    const invalidStorageStateEnc = "invalid-non-json-content";
    await assert.rejects(
      async () => {
        await repository.saveEncrypted(mkt, profileId, { version: 2 }, invalidStorageStateEnc);
      },
      /Falha na validação do arquivo temporário/
    );

    // O arquivo final storageState.enc original deve continuar existindo no estado anterior (que era null do createProfile)
    const dataAfterFailedWrite = await repository.load(mkt, profileId);
    assert.strictEqual(dataAfterFailedWrite?.storageState, null);

    // Tentar gravar um metadata.json válido e verificar persistência
    await repository.saveMetadata(mkt, profileId, { version: 3, updatedBy: 'test' });
    const metadataAfterSuccess = await repository.loadMetadata(mkt, profileId);
    assert.strictEqual(metadataAfterSuccess.version, 3);
    assert.strictEqual(metadataAfterSuccess.updatedBy, 'test');
  });

  await t.test('8. Desacoplamento de metadados e credenciais', async () => {
    const mkt = 'amazon';
    const profileId = 'decoupled-test';
    
    // Criar perfil com estado de sessão válido
    await profileManager.createProfile(mkt, profileId, 'test-system');
    const validState = { cookies: [{ name: 'auth', value: '123' }], origins: [] };
    await repository.save(mkt, profileId, { version: 1 }, validState);

    // Obter data de modificação original do arquivo storageState.enc
    const profilePath = path.join(tmpDir, mkt, profileId);
    const storageStatePath = path.join(profilePath, 'storageState.enc');
    const originalStat = await fs.stat(storageStatePath);
    
    // Aguardar um curto período para garantir diferença no timestamp de modificação se o arquivo fosse gravado
    await new Promise(resolve => setTimeout(resolve, 50));

    // Chamar updateUsage no AuthenticationSessionManager (que agora só deve gravar metadata.json)
    await sessionManager.updateUsage(mkt, profileId, true);

    // Verificar se o metadado foi atualizado no metadata.json
    const meta = await repository.loadMetadata(mkt, profileId);
    assert.strictEqual(meta.authenticationStatus, 'VALID');
    assert.ok(meta.usageCount > 0);

    // Verificar se o arquivo storageState.enc NÃO foi modificado (o timestamp de modificação mtimeMs deve ser idêntico)
    const currentStat = await fs.stat(storageStatePath);
    assert.strictEqual(currentStat.mtimeMs, originalStat.mtimeMs);
  });

  await t.test('9. Concorrência e Lock no AuthenticationSessionManager', async () => {
    const mkt = 'amazon';
    const profileId = 'concurrent-lock-test';
    
    await profileManager.createProfile(mkt, profileId, 'test-system');
    
    // Executar múltiplas chamadas concorrentes a updateUsage
    // O lock deve garantir que elas executem uma de cada vez (serializadas) sem colisão e incrementando corretamente o contador
    const promises = Array.from({ length: 5 }).map(() => 
      sessionManager.updateUsage(mkt, profileId, true)
    );
    
    await Promise.all(promises);

    const meta = await repository.loadMetadata(mkt, profileId);
    assert.strictEqual(meta.usageCount, 5);
  });
});
