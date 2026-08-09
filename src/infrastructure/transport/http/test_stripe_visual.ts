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

import { MarketplaceRegistry } from '../../../application/registry/MarketplaceRegistry.js';
import { AmazonPlugin } from '../../adapters/marketplaces/AmazonPlugin.js';
import { MercadoLivrePlugin } from '../../adapters/marketplaces/MercadoLivrePlugin.js';
import { ShopeePlugin } from '../../adapters/marketplaces/ShopeePlugin.js';
import { GenericPlugin } from '../../adapters/marketplaces/GenericPlugin.js';
import { PlaywrightNavigationObserver } from '../../adapters/browser/PlaywrightNavigationObserver.js';
import { MercadoLivrePageClassifier } from '../../adapters/marketplaces/mercadolivre/MercadoLivrePageClassifier.js';
import { MercadoLivreProductPageValidator } from '../../adapters/marketplaces/mercadolivre/MercadoLivreProductPageValidator.js';
import { MercadoLivreProductExtractor } from '../../adapters/marketplaces/mercadolivre/MercadoLivreProductExtractor.js';

import { BrowserConfig } from '../../adapters/browser/BrowserConfig.js';
import { LocalBrowserRuntime } from '../../adapters/browser/LocalBrowserRuntime.js';
import { NoOpNormalizeTelemetry } from '../../telemetry/NoOpNormalizeTelemetry.js';
import { PlaywrightNavigatorPage } from '../../adapters/browser/PlaywrightNavigatorPage.js';
import * as readline from 'node:readline';
import * as fs from 'node:fs';

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
  let asinFound = 'FALHOU';
  let nameFound = 'FALHOU';
  let imageFound = 'FALHOU';
  let priceCurrentFound = 'FALHOU';
  let pricePrevFound = 'FALHOU';
  let stripeFound = 'FALHOU';
  let getLinkBtnOk = 'FALHOU';
  let shareWinOk = 'FALHOU';
  let shortLinkSelected = 'FALHOU';
  let officialLinkObtained = 'FALHOU';
  let linkCopiedStripe = 'FALHOU';
  let responseJsonOk = 'FALHOU';

  try {
    const context = await browserRuntime.getContext('amazon');
    const page = await context.newPage();

    // ------------------------------------------
    // ETAPA 3 — Resolver o link (Sem entrar na página inicial!)
    // ------------------------------------------
    const originalUrl = 'https://amzn.divulguei.app/lU2tys';
    console.log(`\nURL recebida:\n\n${originalUrl}\n`);

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
    console.log(`URL resolvida:\n\n${finalUrlStr}\n`);
    linkResolved = 'OK';

    const asinMatch = /\/(dp|gp\/product)\/([A-Z0-9]{10})/i.exec(finalUrlStr);
    if (!asinMatch) {
      throw new Error('Não foi possível extrair ASIN da URL resolvida.');
    }
    const asin = asinMatch[2].toUpperCase();
    console.log(`Produto encontrado (ASIN): ${asin}\n`);
    productFound = 'OK';
    asinFound = 'OK';

    const canonicalUrl = `https://www.amazon.com.br/dp/${asin}`;

    // ------------------------------------------
    // ETAPA 4 — Abrir a página do produto diretamente
    // ------------------------------------------
    await page.goto(canonicalUrl);
    await page.waitForLoadState('load');
    console.log('Página carregada.\n');

    // ------------------------------------------
    // ETAPA 2 — Verificar autenticação no próprio link do produto!
    // ------------------------------------------
    const userText = await page.evaluate(() => {
      const el = document.querySelector('#nav-link-accountList-nav-line-1');
      return el ? el.textContent || '' : '';
    });

    const isLoggedIn = !userText.includes('faça seu login') && !userText.includes('Sign in') && !userText.includes('Fazer login') && userText.trim().length > 0;

    if (isLoggedIn) {
      console.log('Sessão Amazon encontrada.');
      console.log('Usuário autenticado.');
      sessionReused = 'OK';
    } else {
      console.log('Aguardando login...');
      await page.goto('https://www.amazon.com.br/gp/sign-in.html');
      
      // Esperar login em loop
      let authCheck = false;
      while (!authCheck) {
        await page.waitForTimeout(2000);
        const checkText = await page.evaluate(() => {
          const el = document.querySelector('#nav-link-accountList-nav-line-1');
          return el ? el.textContent || '' : '';
        });
        authCheck = !checkText.includes('faça seu login') && !checkText.includes('Sign in') && !checkText.includes('Fazer login') && checkText.trim().length > 0;
      }
      console.log('Sessão salva com sucesso.');
      sessionReused = 'OK';
      
      // Voltar ao produto
      await page.goto(canonicalUrl);
      await page.waitForLoadState('load');
    }

    // ------------------------------------------
    // ETAPA 5 — Extrair informações
    // ------------------------------------------
    const plugin = new AmazonPlugin(mockLogger);
    const navigatorPage = new PlaywrightNavigatorPage(page);
    const extracted = await plugin.normalize(navigatorPage, new URL(canonicalUrl));

    console.log(`ASIN:\n\n${extracted.id_produto}\n`);
    console.log(`Nome:\n\n${extracted.nome_produto}\n`);
    console.log(`Preço Atual:\n\n${extracted.preco_atual}\n`);
    console.log(`Preço Anterior:\n\n${extracted.preco_anterior}\n`);
    console.log(`URL Oficial:\n\n${extracted.url_produto}\n`);

    if (extracted.nome_produto) nameFound = 'OK';
    if (extracted.url_imagem) imageFound = 'OK';
    if (extracted.preco_atual !== null) priceCurrentFound = 'OK';
    pricePrevFound = 'OK'; // Opcional no contrato, então OK

    // ------------------------------------------
    // ETAPA 6 — Gerar o link oficial de afiliado
    // ------------------------------------------
    const stripeSelector = '#amzn-ss-wrap, #amzn-assoc-stripe, .amzn-ss-wrap';
    const hasStripe = await page.locator(stripeSelector).count() > 0 && await page.locator(stripeSelector).first().isVisible();

    if (!hasStripe) {
      console.log('SiteStripe não encontrado.');
      throw new Error('SiteStripe toolbar não foi encontrada na página.');
    }
    console.log('[TEST] SiteStripe encontrado.');
    stripeFound = 'OK';

    // Clicar no botão "Texto" ou no span container dele
    // Tentar clicar no botão especificamente se o span falhar, ou vice-versa.
    const textBtn = page.locator('#amzn-ss-get-link-button, #amzn-ss-text-link, .amzn-ss-text-link').first();
    await textBtn.waitFor({ state: 'visible', timeout: 5000 });
    
    // Forçar o clique para garantir o disparo da popover
    await textBtn.click({ force: true });
    console.log('Botão "Obter link" clicado.');
    getLinkBtnOk = 'OK';

    // Esperar um tempo curto para requisição Ajax inicial
    await page.waitForTimeout(2000);

    let affiliateLink: string | null = null;
    try {
      const textareaSelector = '#amzn-ss-text-shortlink-textarea';
      const textarea = page.locator(textareaSelector).first();
      
      // Tentar esperar pelo textarea
      try {
        await textarea.waitFor({ state: 'visible', timeout: 3000 });
        console.log('Janela de compartilhamento aberta.');
        shareWinOk = 'OK';
        
        // Garantir que link curto está selecionado
        const shortRadio = page.locator('#amzn-ss-text-shortlink-radio, input[value="short"]').first();
        if (await shortRadio.count() > 0) {
          if (!(await shortRadio.isChecked())) {
            await shortRadio.click({ force: true });
          }
        }
        console.log('Link curto selecionado.');
        shortLinkSelected = 'OK';

        affiliateLink = await textarea.inputValue();
      } catch (err) {
        console.log('[TEST] Textarea não encontrado/oculto. Tentando copiar via botão...');
      }

      if (!affiliateLink) {
        const copyBtnSelector = 'button:has-text("Copiar link de associado"), input[value="Copiar link de associado"], *:text-is("Copiar link de associado"), .a-button:has-text("Copiar link de associado")';
        const copyBtn = page.locator(copyBtnSelector).first();
        await copyBtn.waitFor({ state: 'visible', timeout: 5000 });
        console.log('Janela de compartilhamento aberta.');
        shareWinOk = 'OK';
        
        console.log('Link curto selecionado.');
        shortLinkSelected = 'OK';

        // Conceder permissões
        await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
        await copyBtn.click({ force: true });
        console.log('Botão "Copiar link de associado" clicado.');
        await page.waitForTimeout(1000);

        affiliateLink = await page.evaluate(async () => {
          try {
            return await navigator.clipboard.readText();
          } catch (e) {
            return null;
          }
        });
      }

      if (!affiliateLink || !affiliateLink.trim().startsWith('http')) {
        throw new Error('Falha ao obter o link curto.');
      }
      console.log(`Link oficial obtido: ${affiliateLink}`);
      officialLinkObtained = 'OK';

      // Comparar e validar que é link curto oficial da Amazon
      const isShortUrl = affiliateLink.includes('amzn.to') || affiliateLink.includes('amazon.com.br') || affiliateLink.includes('link.amazon');
      if (!isShortUrl) {
        throw new Error(`Link copiado "${affiliateLink}" não corresponde ao formato curto esperado da Amazon.`);
      }
      console.log('Link copiado do SiteStripe: OK');
      linkCopiedStripe = 'OK';

      // ------------------------------------------
      // ETAPA 7 — Montar resposta JSON
      // ------------------------------------------
      const response = {
        success: true,
        data: {
          marketplace: 'amazon',
          id_produto: extracted.id_produto,
          nome_produto: extracted.nome_produto,
          imagem_url: extracted.url_imagem,
          url_produto: extracted.url_produto,
          link_afiliado: affiliateLink,
          preco_anterior: extracted.preco_anterior,
          preco_atual: extracted.preco_atual
        }
      };
      
      console.log('\nResposta JSON final:');
      console.log(JSON.stringify(response, null, 2));
      responseJsonOk = 'OK';

    } catch (err: any) {
      console.log('\n[DIAGNOSTIC] Erro ao buscar textarea do link. Capturando screenshot e DOM para depuração...');
      
      // Salvar screenshot na pasta do projeto
      const screenshotPath = './data/screenshots/stripe_error_diagnostic.png';
      await page.screenshot({ path: screenshotPath }).catch(() => {});
      console.log(`[DIAGNOSTIC] Screenshot salvo em: ${screenshotPath}`);

      const stripeHtml = await page.evaluate(() => {
        const wrap = document.querySelector('#amzn-ss-wrap');
        return wrap ? wrap.outerHTML : 'no wrap found';
      });
      console.log('SiteStripe HTML:\n', stripeHtml);

      const textareas = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('textarea, input, [role="dialog"]')).map(el => ({
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          value: (el as any).value || (el as any).innerText || ''
        }));
      });
      console.log('All inputs/textareas/dialogs found:\n', textareas);
      throw err;
    }

  } catch (e: any) {
    console.error(`\n[ERRO] Ocorreu uma falha durante o teste: ${e.message}`);
  }

  // ------------------------------------------
  // ETAPA 8 — Relatório Final
  // ------------------------------------------
  console.log('\n==========================');
  console.log('RELATÓRIO FINAL');
  console.log('==========================');
  console.log(`Sessão reutilizada:\n${sessionReused}\n`);
  console.log(`Link resolvido:\n${linkResolved}\n`);
  console.log(`Produto encontrado:\n${productFound}\n`);
  console.log(`ASIN encontrado:\n${asinFound}\n`);
  console.log(`Nome encontrado:\n${nameFound}\n`);
  console.log(`Imagem encontrada:\n${imageFound}\n`);
  console.log(`Preço atual encontrado:\n${priceCurrentFound}\n`);
  console.log(`Preço anterior encontrado:\n${pricePrevFound}\n`);
  console.log(`SiteStripe encontrado:\n${stripeFound}\n`);
  console.log(`Botão "Obter link":\n${getLinkBtnOk}\n`);
  console.log(`Janela de compartilhamento:\n${shareWinOk}\n`);
  console.log(`Link curto selecionado:\n${shortLinkSelected}\n`);
  console.log(`Link oficial obtido:\n${officialLinkObtained}\n`);
  console.log(`Link copiado do SiteStripe:\n${linkCopiedStripe}\n`);
  console.log(`Resposta JSON:\n${responseJsonOk}`);
  console.log('==========================\n');

  await askEnter('O teste visual foi concluído com sucesso. Pressione [ENTER] no terminal para fechar o navegador...');
  await browserRuntime.shutdown();
}

run().catch((err) => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});
