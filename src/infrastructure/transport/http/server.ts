import Fastify from 'fastify';
import { createRequire } from 'module';
import * as path from 'path';

// Ports
import { IClock } from '../../../domain/ports/IClock.js';

// Domain Models
import { BrowserProfile } from '../../../domain/models/BrowserProfile.js';

// Services
import { NormalizeService } from '../../../application/services/NormalizeService.js';
import { ProfileManager } from '../../../application/services/ProfileManager.js';
import { AuthenticationService } from '../../../application/services/AuthenticationService.js';

// Adapters
import { LocalFileProfileRepository } from '../../adapters/session/LocalFileProfileRepository.js';
import { MemorySessionLockManager } from '../../adapters/session/MemorySessionLockManager.js';
import { SecureCryptoHelper } from '../../adapters/session/SecureCryptoHelper.js';
import { SystemClock } from '../../adapters/browser/SystemClock.js';
import { ApplicationEventBus } from '../../adapters/browser/ApplicationEventBus.js';
import { PinoLogger } from '../../adapters/browser/PinoLogger.js';
import { ApplicationEventLogger } from '../../telemetry/ApplicationEventLogger.js';
import { OpenTelemetryTracer } from '../../telemetry/OpenTelemetryTracer.js';
import { ApplicationEventTracer } from '../../telemetry/ApplicationEventTracer.js';
import { PlaywrightBrowserRuntime } from '../../adapters/browser/PlaywrightBrowserRuntime.js';
import { PlaywrightBrowserSessionFactory } from '../../adapters/browser/PlaywrightBrowserSessionFactory.js';
import { AuthenticationRegistry } from '../../adapters/browser/AuthenticationRegistry.js';
import { AuthenticationCleanupScheduler } from '../../adapters/browser/AuthenticationCleanupScheduler.js';

// Resolvers
import { CompositeUrlResolver } from '../../../application/resolver/CompositeUrlResolver.js';
import { AmazonAffiliateResolver } from '../../adapters/browser/AmazonAffiliateResolver.js';
import { MercadoLivreAffiliateResolver } from '../../adapters/browser/MercadoLivreAffiliateResolver.js';
import { ShopeeAffiliateResolver } from '../../adapters/browser/ShopeeAffiliateResolver.js';
import { GenericRedirectResolver } from '../../adapters/browser/GenericRedirectResolver.js';
import { DirectMarketplaceResolver } from '../../adapters/browser/DirectMarketplaceResolver.js';
import { PlaywrightRedirectResolver } from '../../adapters/browser/PlaywrightRedirectResolver.js';

// Plugins
import { MarketplaceRegistry } from '../../../application/registry/MarketplaceRegistry.js';
import { AmazonPlugin } from '../../adapters/marketplaces/AmazonPlugin.js';
import { MercadoLivrePlugin } from '../../adapters/marketplaces/MercadoLivrePlugin.js';
import { ShopeePlugin } from '../../adapters/marketplaces/ShopeePlugin.js';
import { GenericPlugin } from '../../adapters/marketplaces/GenericPlugin.js';
import { PlaywrightNavigationObserver } from '../../adapters/browser/PlaywrightNavigationObserver.js';
import { MercadoLivrePageClassifier } from '../../adapters/marketplaces/mercadolivre/MercadoLivrePageClassifier.js';
import { MercadoLivreProductPageValidator } from '../../adapters/marketplaces/mercadolivre/MercadoLivreProductPageValidator.js';
import { MercadoLivreProductExtractor } from '../../adapters/marketplaces/mercadolivre/MercadoLivreProductExtractor.js';
import { PlaywrightBrowserLaunchPolicy } from '../../adapters/browser/PlaywrightBrowserLaunchPolicy.js';
import { BrowserContextFactory } from '../../adapters/browser/BrowserContextFactory.js';

// Routes
import { healthRoutes } from './routes/health.js';
import { normalizeRoutes } from './routes/normalize.js';
import { profileRoutes } from './routes/profiles.js';

// Observability Runtime Boot
import { OpenTelemetryRuntime } from '../../telemetry/OpenTelemetryRuntime.js';

const fastify = Fastify({
  logger:
    process.env.NODE_ENV === 'production'
      ? {
          redact: {
            paths: [
              'req.headers.cookie',
              'req.headers.authorization',
              'res.headers["set-cookie"]',
              'body.cookies',
              'body.storageState',
              'headers.cookie',
              'headers.authorization'
            ],
            censor: '***'
          }
        }
      : {
          redact: {
            paths: [
              'req.headers.cookie',
              'req.headers.authorization',
              'res.headers["set-cookie"]',
              'body.cookies',
              'body.storageState',
              'headers.cookie',
              'headers.authorization'
            ],
            censor: '***'
          }
        }
});

// 3. Inicialização de Dependências Comuns (Composition Root)
OpenTelemetryRuntime.initialize();

const clock = new SystemClock();
const eventBus = new ApplicationEventBus();
const pinoLogger = new PinoLogger();
const eventLogger = new ApplicationEventLogger(eventBus, pinoLogger);
eventLogger.start();

const telemetryTracer = new OpenTelemetryTracer();
const eventTracer = new ApplicationEventTracer(eventBus, telemetryTracer);
eventTracer.start();

const cryptoHelper = new SecureCryptoHelper();
const profileRepository = new LocalFileProfileRepository(cryptoHelper);
const lockManager = new MemorySessionLockManager();
const profileManager = new ProfileManager(profileRepository, lockManager, fastify.log);

// Configuração do perfil de navegador realista
const browserProfile: BrowserProfile = {
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
  colorScheme: 'light',
  javaScriptEnabled: true,
  viewport: { width: 1366, height: 768 },
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  extraHTTPHeaders: {
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Upgrade-Insecure-Requests': '1'
  }
};

const launchPolicy = new PlaywrightBrowserLaunchPolicy();
const contextFactory = new BrowserContextFactory(launchPolicy);

const browserRuntime = new PlaywrightBrowserRuntime(fastify.log, launchPolicy);
fastify.log.info(`[Server Bootstrap] browserRuntime criada no server.ts com runtimeId=${browserRuntime.runtimeId}. Ref: [PlaywrightBrowserRuntime@${Math.random().toString(36).substring(2, 8)}]`);
const sessionFactory = new PlaywrightBrowserSessionFactory(browserRuntime, profileManager, browserProfile, contextFactory, fastify.log);

const marketplaceRegistry = new MarketplaceRegistry();
marketplaceRegistry.register(new AmazonPlugin(fastify.log));
marketplaceRegistry.register(
  new MercadoLivrePlugin(
    fastify.log,
    new MercadoLivrePageClassifier(),
    new PlaywrightNavigationObserver(fastify.log),
    new MercadoLivreProductPageValidator(),
    new MercadoLivreProductExtractor(fastify.log)
  )
);
marketplaceRegistry.register(new ShopeePlugin(fastify.log));
marketplaceRegistry.registerFallback(new GenericPlugin());

const authenticationRegistry = new AuthenticationRegistry(fastify.log);
const authenticationCleanupScheduler = new AuthenticationCleanupScheduler(authenticationRegistry, eventBus, contextFactory, fastify.log);
const authenticationService = new AuthenticationService(
  browserRuntime,
  authenticationRegistry,
  eventBus,
  marketplaceRegistry,
  profileManager,
  browserProfile,
  contextFactory,
  fastify.log
);

// Resolvedores de URL e Normalização
const compositeUrlResolver = new CompositeUrlResolver(
  [
    new DirectMarketplaceResolver(),
    new AmazonAffiliateResolver(fastify.log),
    new MercadoLivreAffiliateResolver(fastify.log),
    new ShopeeAffiliateResolver(fastify.log),
    new GenericRedirectResolver(fastify.log),
    new PlaywrightRedirectResolver(sessionFactory, fastify.log)
  ],
  fastify.log
);

const normalizeService = new NormalizeService(compositeUrlResolver, marketplaceRegistry, sessionFactory, eventBus);

// 4. Registro de Rotas
fastify.register(healthRoutes, { browserRuntime });
fastify.register(normalizeRoutes, { normalizeService });
fastify.register(profileRoutes, { profileManager, authenticationService });

// 5. Hooks de Inicialização e Encerramento (Graceful Shutdown)
fastify.addHook('onClose', async () => {
  authenticationCleanupScheduler.stop();
  await browserRuntime.shutdown();
  await OpenTelemetryRuntime.forceFlush();
  await OpenTelemetryRuntime.shutdown();
});

const gracefulShutdown = async (signal: string) => {
  fastify.log.info(`Recebido sinal ${signal}. Fechando servidor Fastify...`);
  try {
    await fastify.close();
    fastify.log.info('Servidor encerrado com sucesso.');
    process.exit(0);
  } catch (err) {
    fastify.log.error(err, 'Erro durante o encerramento do servidor');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 6. Bootstrap do Servidor
const PORT = Number(process.env.PORT) || 3006;
const HOST = process.env.HOST || '0.0.0.0';

const start = async () => {
  let runtimeStarted = false;
  let schedulerStarted = false;

  try {
    await browserRuntime.start();
    runtimeStarted = true;

    authenticationCleanupScheduler.start();
    schedulerStarted = true;

    await fastify.ready();

    console.log('================ ROUTES ================');
    console.log(fastify.printRoutes());
    console.log('========================================');

    await fastify.listen({
      port: PORT,
      host: HOST
    });

    fastify.log.info(`Servidor escutando em http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err, 'Erro fatal no bootstrap do servidor. Iniciando limpeza de recursos...');
    
    if (schedulerStarted) {
      try {
        authenticationCleanupScheduler.stop();
      } catch (e) {}
    }
    if (runtimeStarted) {
      try {
        await browserRuntime.shutdown();
      } catch (e) {}
    }
    try {
      await fastify.close();
    } catch (e) {}

    process.exit(1);
  }
};

start();
