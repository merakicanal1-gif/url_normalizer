import Fastify from 'fastify';
import { createRequire } from 'module';
import * as path from 'path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';

// Domain Models
import { BrowserProfile } from '../../../domain/models/BrowserProfile.js';

// Services
import { NormalizeService } from '../../../application/services/NormalizeService.js';

// Adapters
import { SystemClock } from '../../adapters/browser/SystemClock.js';
import { ApplicationEventBus } from '../../adapters/browser/ApplicationEventBus.js';
import { PinoLogger } from '../../adapters/browser/PinoLogger.js';
import { ApplicationEventLogger } from '../../telemetry/ApplicationEventLogger.js';
import { OpenTelemetryTracer } from '../../telemetry/OpenTelemetryTracer.js';
import { ApplicationEventTracer } from '../../telemetry/ApplicationEventTracer.js';
import { PlaywrightBrowserSessionFactory } from '../../adapters/browser/PlaywrightBrowserSessionFactory.js';
import { AuthenticationRegistry } from '../../adapters/browser/AuthenticationRegistry.js';
import { StructuredNormalizeTelemetry } from '../../telemetry/StructuredNormalizeTelemetry.js';

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

// Novas classes do Navegador Persistente Local
import { BrowserConfig } from '../../adapters/browser/BrowserConfig.js';
import { LocalBrowserRuntime } from '../../adapters/browser/LocalBrowserRuntime.js';
import { BrowserHealthService } from '../../../application/services/BrowserHealthService.js';

// Routes
import { healthRoutes } from './routes/health.js';
import { normalizeRoutes } from './routes/normalize.js';
import { browserRoutes } from './routes/browser.js';

// Observability Runtime Boot
import { OpenTelemetryRuntime } from '../../telemetry/OpenTelemetryRuntime.js';

// 6. Bootstrap do Servidor
const PORT = Number(process.env.PORT) || 3007;
const HOST = process.env.HOST || '0.0.0.0';

function getTailscaleIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const list = interfaces[name];
    if (list) {
      for (const net of list) {
        if (net.family === 'IPv4' && !net.internal) {
          if (net.address.startsWith('100.')) {
            return net.address;
          }
        }
      }
    }
  }

  try {
    const stdout = execSync('tailscale ip -4', { encoding: 'utf8', timeout: 2000 });
    if (stdout && stdout.trim()) {
      return stdout.trim();
    }
  } catch (e) {
    // ignorar
  }

  return '100.xxx.xxx.xxx (Tailscale não ativo ou não encontrado)';
}

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

// 3.1. Inicializar Runtime e Health do Navegador Persistente Local
const browserConfig = new BrowserConfig();
const browserRuntime = new LocalBrowserRuntime(browserConfig, eventBus, fastify.log);
const browserHealthService = new BrowserHealthService(browserRuntime);

const sessionFactory = new PlaywrightBrowserSessionFactory(browserRuntime, fastify.log);

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

// Mantemos o AuthenticationRegistry para documentar regras dos marketplaces localmente
const authenticationRegistry = new AuthenticationRegistry(fastify.log);

const normalizeTelemetry = new StructuredNormalizeTelemetry(pinoLogger);

// Resolvedores de URL e Normalização
const playwrightRedirectResolver = new PlaywrightRedirectResolver(sessionFactory, fastify.log, normalizeTelemetry);

const compositeUrlResolver = new CompositeUrlResolver(
  [
    new DirectMarketplaceResolver(),
    new AmazonAffiliateResolver(fastify.log),
    new MercadoLivreAffiliateResolver(fastify.log),
    new ShopeeAffiliateResolver(fastify.log),
    new GenericRedirectResolver(fastify.log),
    playwrightRedirectResolver
  ],
  fastify.log,
  normalizeTelemetry
);

const normalizeService = new NormalizeService(
  compositeUrlResolver,
  marketplaceRegistry,
  sessionFactory,
  eventBus,
  30000,
  normalizeTelemetry
);

// Hook global de Autenticação via API Key (excluindo endpoints /health)
fastify.addHook('preHandler', async (request, reply) => {
  const apiKeyEnabled = process.env.API_KEY_ENABLED === 'true';
  if (!apiKeyEnabled) {
    return;
  }

  if (request.url.startsWith('/health')) {
    return;
  }

  const apiKey = request.headers['x-api-key'];
  const expectedKey = process.env.API_KEY;

  if (!apiKey || apiKey !== expectedKey) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Chave de API inválida ou não fornecida.'
      }
    });
  }
});

// 4. Registro de Rotas
fastify.register(healthRoutes, { 
  browserHealthService,
  host: HOST,
  port: PORT,
  tailscaleIp: getTailscaleIp()
});
fastify.register(normalizeRoutes, { normalizeService });
fastify.register(browserRoutes, {
  browserRuntime,
  browserHealthService,
  marketplaceRegistry
});

// 5. Hooks de Inicialização e Encerramento (Graceful Shutdown)
fastify.addHook('onClose', async () => {
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

const handleFatalError = async (type: string, err: any) => {
  fastify.log.error(err, `Erro fatal não tratado no processo do Node: ${type}`);
  try {
    await browserRuntime.shutdown();
  } catch (e) {}
  process.exit(1);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => handleFatalError('uncaughtException', err));
process.on('unhandledRejection', (reason) => handleFatalError('unhandledRejection', reason));

// Bootstrap configurado

const start = async () => {
  let runtimeStarted = false;

  try {
    if (browserConfig.autoStartBrowser) {
      await browserRuntime.start();
      runtimeStarted = true;
    } else {
      fastify.log.info('[server] BROWSER_MODE is cdp and AUTO_START_BROWSER is false. Skipping auto-start connection at boot.');
    }

    await fastify.ready();

    console.log('================ ROUTES ================');
    console.log(fastify.printRoutes());
    console.log('========================================');

    await fastify.listen({
      port: PORT,
      host: HOST
    });

    const envName = process.env.NODE_ENV === 'production' ? 'Production' : 'Development';
    const isHeadless = browserConfig.headless ? 'true' : 'false';
    const tailscaleIp = getTailscaleIp();
    const isAmazonLoaded = fs.existsSync(path.join(browserConfig.userDataDir, 'amazon')) ? 'Loaded' : 'Not Loaded';
    const isMercadoLivreLoaded = fs.existsSync(path.join(browserConfig.userDataDir, 'mercadolivre')) ? 'Loaded' : 'Not Loaded';
    const browserModeStr = browserConfig.browserMode === 'persistent' ? 'Playwright Persistent' : 'Chrome CDP';
    const isHealthy = browserRuntime.isAlive() ? 'OK' : 'DEGRADED';
    
    const hasTailscale = tailscaleIp && !tailscaleIp.includes('não ativo') && !tailscaleIp.includes('não encontrado');
    const tailnetUrl = hasTailscale ? `http://${tailscaleIp}:${PORT}` : 'http://100.xxx.xxx.xxx:3007';

    console.log('======================================');
    console.log('URL Normalizer');
    console.log(`Environment..... ${envName}`);
    console.log(`Host............ ${HOST}`);
    console.log(`Port............ ${PORT}`);
    console.log(`Local........... http://localhost:${PORT}`);
    console.log(`Tailnet......... ${tailnetUrl}`);
    console.log(`Browser......... ${browserModeStr}`);
    console.log(`Headless........ ${isHeadless}`);
    console.log(`Amazon.......... ${isAmazonLoaded}`);
    console.log(`Mercado Livre... ${isMercadoLivreLoaded}`);
    console.log(`Health.......... ${isHealthy}`);
    console.log('Ready for n8n.');
    console.log('======================================');
  } catch (err) {
    fastify.log.error(err, 'Erro fatal no bootstrap do servidor. Iniciando limpeza de recursos...');
    
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
