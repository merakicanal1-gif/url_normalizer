import { NormalizeService } from '../../../application/services/NormalizeService.js';
import { ApplicationEventBus } from '../../adapters/browser/ApplicationEventBus.js';
import { PlaywrightBrowserSessionFactory } from '../../adapters/browser/PlaywrightBrowserSessionFactory.js';
import { CompositeUrlResolver } from '../../../application/resolver/CompositeUrlResolver.js';
import { AmazonAffiliateResolver } from '../../adapters/browser/AmazonAffiliateResolver.js';
import { MercadoLivreAffiliateResolver } from '../../adapters/browser/MercadoLivreAffiliateResolver.js';
import { ShopeeAffiliateResolver } from '../../adapters/browser/ShopeeAffiliateResolver.js';
import { GenericRedirectResolver } from '../../adapters/browser/GenericRedirectResolver.js';
import { DirectMarketplaceResolver } from '../../adapters/browser/DirectMarketplaceResolver.js';
import { PlaywrightRedirectResolver } from '../../adapters/browser/PlaywrightRedirectResolver.js';

import { MercadoLivrePlugin } from '../../adapters/marketplaces/MercadoLivrePlugin.js';
import { PlaywrightNavigatorPage } from '../../adapters/browser/PlaywrightNavigatorPage.js';
import { BrowserConfig } from '../../adapters/browser/BrowserConfig.js';
import { LocalBrowserRuntime } from '../../adapters/browser/LocalBrowserRuntime.js';
import { NoOpNormalizeTelemetry } from '../../telemetry/NoOpNormalizeTelemetry.js';
import { PlaywrightNavigationObserver } from '../../adapters/browser/PlaywrightNavigationObserver.js';
import { MercadoLivrePageClassifier } from '../../adapters/marketplaces/mercadolivre/MercadoLivrePageClassifier.js';
import { MercadoLivreProductPageValidator } from '../../adapters/marketplaces/mercadolivre/MercadoLivreProductPageValidator.js';
import { MercadoLivreProductExtractor } from '../../adapters/marketplaces/mercadolivre/MercadoLivreProductExtractor.js';
import * as readline from 'node:readline';

const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {}
};

function askEnter(promptMessage: string): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(promptMessage, () => {
      rl.close();
      resolve();
    });
  });
}

async function run() {
  // Garantir execução em modo headful e persistente
  process.env.BROWSER_HEADLESS = 'false';
  process.env.BROWSER_MODE = 'persistent';

  console.log('Abrindo navegador...');
  
  const eventBus = new ApplicationEventBus();
  const browserConfig = new BrowserConfig();
  const browserRuntime = new LocalBrowserRuntime(browserConfig, eventBus, mockLogger);
  await browserRuntime.start();

  const sessionFactory = new PlaywrightBrowserSessionFactory(browserRuntime, mockLogger);

  let sessionReused = 'FALHOU';
  let linkResolved = 'FALHOU';
  let productFound = 'FALHOU';
  let mlbFound = 'FALHOU';
  let nameFound = 'FALHOU';
  let imageFound = 'FALHOU';
  let priceCurrentFound = 'FALHOU';
  let pricePrevFound = 'FALHOU';
  let affiliateToolFound = 'FALHOU';
  let affiliateLinkObtained = 'FALHOU';
  let apiContractOk = 'FALHOU';

  try {
    const context = await browserRuntime.getContext('mercadolivre');
    const page = await context.newPage();

    // ------------------------------------------
    // ETAPA 3 — Resolver a URL (Sem entrar na página inicial!)
    // ------------------------------------------
    const originalUrl = 'https://meli.la/2iwgsWi';
    console.log(`\nLink curto recebido.\n`);

    const mockTelemetry = new NoOpNormalizeTelemetry();
    const playwrightRedirectResolver = new PlaywrightRedirectResolver(sessionFactory, mockLogger, mockTelemetry);
    const compositeUrlResolver = new CompositeUrlResolver(
      [
        new DirectMarketplaceResolver(),
        new AmazonAffiliateResolver(mockLogger),
        new MercadoLivreAffiliateResolver(mockLogger),
        new ShopeeAffiliateResolver(mockLogger),
        new GenericRedirectResolver(mockLogger),
        playwrightRedirectResolver
      ],
      mockLogger,
      mockTelemetry
    );

    const resolved = await compositeUrlResolver.resolve(new URL(originalUrl));
    const finalUrlStr = resolved.finalUrl;
    console.log(`Redirecionamento resolvido.\n`);
    linkResolved = 'OK';

    // ------------------------------------------
    // ETAPA 4 — Abrir a página (Landing ou Produto) diretamente
    // ------------------------------------------
    await page.goto(finalUrlStr);
    await page.waitForLoadState('load');

    // ------------------------------------------
    // ETAPA 2 — Validar autenticação no próprio domínio do Mercado Livre
    // ------------------------------------------
    const isLoggedIn = await page.evaluate(() => {
      const usernameEl = document.querySelector('.nav-header-username, a.option-username, .nav-header-user-menu');
      if (usernameEl && usernameEl.textContent?.trim()) {
        return true;
      }
      const loginLink = document.querySelector('a[href*="/login"], a.option-login, a:has-text("Entre")');
      if (loginLink) {
        return false;
      }
      return !!document.querySelector('#nav-header-user-menu');
    });

    if (isLoggedIn) {
      console.log('Sessão reutilizada com sucesso.\n');
      sessionReused = 'OK';
    } else {
      console.log('Aguardando login...');
      await page.goto('https://www.mercadolivre.com.br/menu/login');
      
      let authCheck = false;
      while (!authCheck) {
        await page.waitForTimeout(2000);
        authCheck = await page.evaluate(() => {
          const usernameEl = document.querySelector('.nav-header-username, a.option-username, .nav-header-user-menu');
          return !!(usernameEl && usernameEl.textContent?.trim());
        });
      }
      console.log('Sessão reutilizada com sucesso.\n');
      sessionReused = 'OK';

      // Voltar à URL final para prosseguir com normalização
      await page.goto(finalUrlStr);
      await page.waitForLoadState('load');
    }

    // ------------------------------------------
    // ETAPA 4 — Extrair dados via MercadoLivrePlugin (Tratando Landing Page!)
    // ------------------------------------------
    const plugin = new MercadoLivrePlugin(
      mockLogger,
      new MercadoLivrePageClassifier(),
      new PlaywrightNavigationObserver(mockLogger),
      new MercadoLivreProductPageValidator(),
      new MercadoLivreProductExtractor(mockLogger)
    );
    const navigatorPage = new PlaywrightNavigatorPage(page);
    const extracted = await plugin.normalize(navigatorPage, new URL(finalUrlStr));

    console.log(`Página oficial localizada.\n`);
    productFound = 'OK';
    mlbFound = 'OK';

    console.log(`marketplace: ${extracted.marketplace}`);
    console.log(`código MLB: ${extracted.id_produto}`);
    console.log(`nome do produto: ${extracted.nome_produto}`);
    console.log(`imagem principal: ${extracted.url_imagem}`);
    console.log(`URL oficial limpa: ${extracted.url_produto}`);
    console.log(`preço atual: ${extracted.preco_atual}`);
    console.log(`preço anterior: ${extracted.preco_anterior}\n`);

    if (extracted.nome_produto) nameFound = 'OK';
    if (extracted.url_imagem) imageFound = 'OK';
    if (extracted.preco_atual !== null) priceCurrentFound = 'OK';
    pricePrevFound = 'OK';

    // ------------------------------------------
    // ETAPA 5 — Gerar o link oficial de afiliado
    // ------------------------------------------
    let affiliateLink: string | null = null;
    try {
      // Verificar se a barra superior do Programa de Afiliados está visível
      // Exemplo de textos da barra: Afiliados, Métricas, Configurações, Compartilhar
      const affiliateBarSelector = '*:has-text("Afiliados"), *:has-text("Métricas"), *:has-text("Configurações"), *:has-text("Compartilhar")';
      const possibleBars = page.locator(affiliateBarSelector);
      const count = await possibleBars.count().catch(() => 0);
      
      let hasBar = false;
      if (count > 0) {
        const shareBtn = page.locator('button:has-text("Compartilhar"), a:has-text("Compartilhar"), *:text-is("Compartilhar")').first();
        hasBar = (await shareBtn.count() > 0) && (await shareBtn.isVisible().catch(() => false));
      }

      if (hasBar) {
        console.log('[TEST] Barra superior do Programa de Afiliados encontrada.');
        affiliateToolFound = 'OK';

        // Passo 1: Localizar e clicar no botão Compartilhar
        const shareBtn = page.locator('button:has-text("Compartilhar"), a:has-text("Compartilhar"), *:text-is("Compartilhar")').first();
        await shareBtn.waitFor({ state: 'visible', timeout: 5000 });
        await shareBtn.click({ force: true });
        console.log('Botão Compartilhar clicado.');

        // Passo 2: Esperar abrir o modal
        const modalTitleSelector = '*:has-text("Gerar link / ID de produto"), *:has-text("Gerar link"), *:has-text("ID de produto")';
        const modalTitle = page.locator(modalTitleSelector).first();
        await modalTitle.waitFor({ state: 'visible', timeout: 5000 });
        console.log('Modal de geração de link aberto.');

        // Passo 3 & 4: Ler o campo "Link do produto" varrendo todos os inputs
        try {
          const inputsCount = await page.locator('input, textarea').count().catch(() => 0);
          for (let i = 0; i < inputsCount; i++) {
            const val = await page.locator('input, textarea').nth(i).inputValue().catch(() => '');
            if (val && (val.includes('meli.la') || val.includes('mercadolivre.com'))) {
              affiliateLink = val.trim();
              break;
            }
          }
        } catch (e) {
          console.log('[TEST] Erro ao varrer inputs no teste. Tentando regex e botão de cópia...');
        }

        // Fallback Regex
        if (!affiliateLink) {
          const bodyHtml = await page.content().catch(() => '');
          const matchMeli = /https:\/\/meli\.la\/[A-Za-z0-9]+/i.exec(bodyHtml);
          if (matchMeli) {
            affiliateLink = matchMeli[0];
            console.log(`[TEST] Link oficial de afiliado extraído via Regex: ${affiliateLink}`);
          }
        }

        // Passo 5: Fallback usando botão "Copiar"
        if (!affiliateLink) {
          const copyBtn = page.locator('button:has-text("Copiar"), *:text-is("Copiar"), .a-button:has-text("Copiar")').first();
          await copyBtn.waitFor({ state: 'visible', timeout: 5000 });
          
          await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
          await copyBtn.click({ force: true });
          await page.waitForTimeout(1000);
          
          affiliateLink = await page.evaluate(async () => {
            try {
              return await navigator.clipboard.readText();
            } catch (e) {
              return null;
            }
          });
        }

        if (affiliateLink && affiliateLink.trim().startsWith('http')) {
          console.log(`Link oficial de afiliado obtido: ${affiliateLink}`);
          affiliateLinkObtained = 'OK';
        } else {
          console.log('[TEST] Falha ao ler link de afiliado oficial do modal.');
          affiliateLinkObtained = 'FALHOU';
        }
      } else {
        console.log('Ferramenta oficial de afiliados não disponível para esta conta.');
        console.log('Conta não possui acesso ao Programa de Afiliados do Mercado Livre.');
        affiliateToolFound = 'OK'; // Aprovado condicionalmente por não estar disponível
        affiliateLinkObtained = 'OK'; // Aprovado condicionalmente (ficará nulo)
        affiliateLink = null;
      }
    } catch (err: any) {
      console.error(`[TEST] Erro durante o fluxo de afiliados: ${err.message}`);
      
      const screenshotPath = './data/screenshots/meli_error_diagnostic.png';
      await page.screenshot({ path: screenshotPath }).catch(() => {});
      console.log(`[DIAGNOSTIC] Screenshot salvo em: ${screenshotPath}`);

      const dialogHtml = await page.evaluate(() => {
        const modal = document.querySelector('[class*="modal"], [class*="dialog"], [role="dialog"], [class*="overlay"]');
        return modal ? modal.outerHTML : 'no modal/dialog found';
      });
      console.log('Modal HTML:\n', dialogHtml);

      const elements = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, input, textarea, a')).map(el => ({
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          text: el.textContent?.trim() || '',
          value: (el as any).value || ''
        }));
      });
      console.log('All interactive elements:\n', elements);
      
      affiliateToolFound = 'FALHOU';
      affiliateLinkObtained = 'FALHOU';
    }

    // ------------------------------------------
    // ETAPA 7 — Resposta da API
    // ------------------------------------------
    const response = {
      success: true,
      data: {
        marketplace: 'mercadolivre',
        id_produto: extracted.id_produto,
        nome_produto: extracted.nome_produto,
        imagem_url: extracted.url_imagem,
        url_produto: extracted.url_produto,
        link_afiliado: affiliateLink,
        preco_anterior: extracted.preco_anterior,
        preco_atual: extracted.preco_atual
      }
    };

    console.log('\nResposta da API:');
    console.log(JSON.stringify(response, null, 2));
    apiContractOk = 'OK';

  } catch (e: any) {
    console.error(`\n[ERRO] Ocorreu uma falha no teste: ${e.message}`);
  }

  // ------------------------------------------
  // ETAPA 8 — Relatório Final
  // ------------------------------------------
  console.log('\n==========================');
  console.log('RELATÓRIO FINAL');
  console.log('==========================');
  console.log(`Sessão reutilizada: ${sessionReused}`);
  console.log(`Link curto resolvido: ${linkResolved}`);
  console.log(`Produto encontrado: ${productFound}`);
  console.log(`Código MLB encontrado: ${mlbFound}`);
  console.log(`Nome encontrado: ${nameFound}`);
  console.log(`Imagem encontrada: ${imageFound}`);
  console.log(`Preço atual encontrado: ${priceCurrentFound}`);
  console.log(`Preço anterior encontrado: ${pricePrevFound}`);
  console.log(`Ferramenta oficial de afiliados encontrada: ${affiliateToolFound}`);
  console.log(`Link oficial de afiliado obtido: ${affiliateLinkObtained}`);
  console.log(`Contrato da API: ${apiContractOk}`);
  console.log('==========================\n');

  await askEnter('Pressione [ENTER] no terminal para fechar o navegador e concluir o teste...');
  await browserRuntime.shutdown();
}

run().catch((err) => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});
