import { FastifyInstance } from 'fastify';
import { IBrowserRuntime } from '../../../../domain/ports/IBrowserRuntime.js';
import { BrowserHealthService } from '../../../../application/services/BrowserHealthService.js';
import { MarketplaceRegistry } from '../../../../application/registry/MarketplaceRegistry.js';
import { BrowserNotRunningError } from '../../../../domain/errors/BrowserNotRunningError.js';

export async function browserRoutes(
  fastify: FastifyInstance,
  options: {
    browserRuntime: IBrowserRuntime;
    browserHealthService: BrowserHealthService;
    marketplaceRegistry: MarketplaceRegistry;
  }
) {
  const { browserRuntime, browserHealthService, marketplaceRegistry } = options;

  // Unifica open e login
  fastify.post('/browser/open', async (request, reply) => {
    const { marketplace, url: customUrl } = request.body as any || {};

    if (!marketplace && !customUrl) {
      return reply.status(400).send({
        success: false,
        error: 'É obrigatório fornecer o campo "marketplace" ou uma "url" específica.'
      });
    }

    let targetUrl = customUrl;

    if (!targetUrl && marketplace) {
      const plugin = marketplaceRegistry.getPlugins().find(
        p => p.getMarketplaceName() === marketplace.toLowerCase()
      );

      if (plugin) {
        targetUrl = plugin.getInteractiveEntryUrl();
      } else {
        // Fallbacks padrão
        const mktName = marketplace.toLowerCase();
        if (mktName === 'amazon') {
          targetUrl = 'https://www.amazon.com.br';
        } else if (mktName === 'mercadolivre') {
          targetUrl = 'https://www.mercadolivre.com.br';
        } else if (mktName === 'shopee') {
          targetUrl = 'https://shopee.com.br';
        } else {
          return reply.status(400).send({
            success: false,
            error: `Marketplace não suportado: ${marketplace}`
          });
        }
      }
    }

    try {
      fastify.log.info(`[browserRoutes] Abrindo aba manual para URL: ${targetUrl}`);
      
      // Criar aba marcada como manual/não-gerenciada (isManaged = false)
      const page = await browserRuntime.newPage(false);
      
      // Carregar a página e aguardar até domcontentloaded
      await page.goto(targetUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 45000 
      });

      // Trazer a aba para o foco do usuário no desktop
      await page.bringToFront().catch(() => {});

      return reply.status(200).send({
        success: true,
        message: `Página para ${marketplace || 'URL customizada'} aberta e pronta para login.`
      });
    } catch (err: any) {
      if (err instanceof BrowserNotRunningError || err.code === 'BROWSER_NOT_RUNNING') {
        return reply.status(503).send({
          success: false,
          code: 'BROWSER_NOT_RUNNING',
          message: err.message,
          documentation: err.documentation || '/docs/browser-setup'
        });
      }
      fastify.log.error(err, `Erro ao abrir aba para ${targetUrl}`);
      return reply.status(500).send({
        success: false,
        error: err.message
      });
    }
  });

  // Fecha todas as abas gerenciadas pela API
  fastify.post('/browser/close', async (request, reply) => {
    try {
      fastify.log.info('[browserRoutes] Solicitando fechamento de todas as abas gerenciadas...');
      await browserRuntime.closeAllPages();

      return reply.status(200).send({
        success: true,
        message: 'Todas as abas gerenciadas do navegador foram fechadas com sucesso.'
      });
    } catch (err: any) {
      if (err instanceof BrowserNotRunningError || err.code === 'BROWSER_NOT_RUNNING') {
        return reply.status(503).send({
          success: false,
          code: 'BROWSER_NOT_RUNNING',
          message: err.message,
          documentation: err.documentation || '/docs/browser-setup'
        });
      }
      fastify.log.error(err, 'Erro ao fechar abas do navegador');
      return reply.status(500).send({
        success: false,
        error: err.message
      });
    }
  });

  // Reseta o estado (fecha todas as abas gerenciadas e deixa limpo)
  fastify.post('/browser/reset', async (request, reply) => {
    try {
      fastify.log.info('[browserRoutes] Resetando navegador (fechando todas as abas gerenciadas)...');
      await browserRuntime.closeAllPages();

      return reply.status(200).send({
        success: true,
        message: 'Navegador limpo com sucesso (zero abas gerenciadas abertas).'
      });
    } catch (err: any) {
      if (err instanceof BrowserNotRunningError || err.code === 'BROWSER_NOT_RUNNING') {
        return reply.status(503).send({
          success: false,
          code: 'BROWSER_NOT_RUNNING',
          message: err.message,
          documentation: err.documentation || '/docs/browser-setup'
        });
      }
      fastify.log.error(err, 'Erro ao resetar navegador');
      return reply.status(500).send({
        success: false,
        error: err.message
      });
    }
  });

  // Reinicia o navegador (apenas modo persistent) ou reconecta CDP (modo cdp)
  fastify.post('/browser/restart', async (request, reply) => {
    try {
      fastify.log.info('[browserRoutes] Executando restart do navegador...');
      await browserRuntime.restart();
      
      return reply.status(200).send({
        success: true,
        message: 'Navegador/conexão reiniciado com sucesso.'
      });
    } catch (err: any) {
      if (err instanceof BrowserNotRunningError || err.code === 'BROWSER_NOT_RUNNING') {
        return reply.status(503).send({
          success: false,
          code: 'BROWSER_NOT_RUNNING',
          message: err.message,
          documentation: err.documentation || '/docs/browser-setup'
        });
      }
      fastify.log.error(err, 'Erro ao reiniciar navegador');
      return reply.status(500).send({
        success: false,
        error: err.message
      });
    }
  });

  // Conecta ou reconecta via CDP (apenas modo cdp)
  fastify.post('/browser/connect', async (request, reply) => {
    if ((browserRuntime as any).getBrowserConfig().browserMode === 'persistent') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'NOT_SUPPORTED',
          message: 'Esta operação não está disponível no modo Persistent.'
        }
      });
    }
    try {
      fastify.log.info('[browserRoutes] Conectando via CDP...');
      await browserRuntime.connect();
      
      return reply.status(200).send({
        success: true,
        message: 'Conexão via CDP estabelecida com sucesso.'
      });
    } catch (err: any) {
      if (err instanceof BrowserNotRunningError || err.code === 'BROWSER_NOT_RUNNING') {
        return reply.status(503).send({
          success: false,
          code: 'BROWSER_NOT_RUNNING',
          message: err.message,
          documentation: err.documentation || '/docs/browser-setup'
        });
      }
      fastify.log.error(err, 'Erro ao conectar via CDP');
      return reply.status(500).send({
        success: false,
        error: err.message
      });
    }
  });

  // Desconecta da sessão CDP sem fechar navegador ou abas (apenas modo cdp)
  fastify.post('/browser/disconnect', async (request, reply) => {
    if ((browserRuntime as any).getBrowserConfig().browserMode === 'persistent') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'NOT_SUPPORTED',
          message: 'Esta operação não está disponível no modo Persistent.'
        }
      });
    }
    try {
      fastify.log.info('[browserRoutes] Desconectando da sessão CDP...');
      await browserRuntime.disconnect();
      
      return reply.status(200).send({
        success: true,
        message: 'Desconexão via CDP realizada com sucesso.'
      });
    } catch (err: any) {
      fastify.log.error(err, 'Erro ao desconectar');
      return reply.status(500).send({
        success: false,
        error: err.message
      });
    }
  });

  // Obtém telemetria do BrowserHealthService
  fastify.get('/browser/status', async (request, reply) => {
    try {
      const status = await browserHealthService.getStatus();
      return reply.status(200).send({
        connected: status.connected,
        mode: status.mode,
        endpoint: status.endpoint,
        browser: status.browserName,
        version: status.browserVersion,
        contexts: status.contexts,
        pages: status.pages,
        ready: status.ready,
        browserAlive: status.browserAlive,
        contextAlive: status.contextAlive,
        managedPages: status.managedPages,
        manualPages: status.manualPages,
        lastReconnect: status.lastReconnect,
        uptime: status.uptime
      });
    } catch (err: any) {
      if (err instanceof BrowserNotRunningError || err.code === 'BROWSER_NOT_RUNNING') {
        return reply.status(503).send({
          success: false,
          code: 'BROWSER_NOT_RUNNING',
          message: err.message,
          documentation: err.documentation || '/docs/browser-setup'
        });
      }
      fastify.log.error(err, 'Erro ao obter telemetria do navegador');
      return reply.status(500).send({
        success: false,
        error: err.message
      });
    }
  });
}
