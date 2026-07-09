import { ResolvedUrl } from '../../../domain/ports/IUrlResolver.js';

interface HttpRedirectStep {
  url: string;
  statusCode: number;
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
};

export async function followHttpRedirects(
  initialUrl: URL,
  maxRedirects: number = 10,
  logger: { info: (msg: string) => void; error: (msg: string, err?: any) => void }
): Promise<{
  finalUrl: string;
  statusCode: number | null;
  redirects: HttpRedirectStep[];
  detectedChallenge: boolean;
  detectedCaptcha: boolean;
  detectedConsent: boolean;
  detectedLogin: boolean;
  challengeType?: 'CAPTCHA' | 'WAF' | 'CONSENT' | 'LOGIN' | 'UNKNOWN';
  pageTitle: string;
  resolvedSuccess: boolean;
}> {
  const initialUrlString = initialUrl.toString();
  let currentUrl = initialUrlString;
  const redirects: HttpRedirectStep[] = [];
  let statusCode: number | null = null;
  
  for (let i = 0; i < maxRedirects; i++) {
    logger.info(`[HTTP Resolver] Requisitando (HEAD) URL: ${currentUrl}`);
    let response: Response;
    let method: 'HEAD' | 'GET' = 'HEAD';

    try {
      response = await fetch(currentUrl, { 
        method: 'HEAD', 
        redirect: 'manual',
        headers: BROWSER_HEADERS
      });
      
      // Se der erro de método não suportado ou bloqueio HEAD, tenta com GET
      if (response.status === 405 || response.status === 403 || response.status === 400) {
        logger.info(`[HTTP Resolver] HEAD retornou status ${response.status}. Tentando GET em: ${currentUrl}`);
        method = 'GET';
        response = await fetch(currentUrl, { 
          method: 'GET', 
          redirect: 'manual',
          headers: BROWSER_HEADERS
        });
      }
    } catch (e: any) {
      logger.info(`[HTTP Resolver] Falha de conexão na URL: ${currentUrl}. Erro: ${e.message}`);
      throw e;
    }

    statusCode = response.status;
    
    // Se for redirect (3xx)
    if (statusCode >= 300 && statusCode <= 399) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error(`Redirecionamento 3xx sem cabeçalho Location na URL: ${currentUrl}`);
      }
      
      const resolvedLocation = new URL(location, currentUrl).toString();
      redirects.push({ url: currentUrl, statusCode });
      
      // Verifica loop de redirecionamento
      if (redirects.some(r => r.url === resolvedLocation)) {
        throw new Error(`Loop de redirecionamento detectado para URL: ${resolvedLocation}`);
      }
      
      currentUrl = resolvedLocation;
    } else {
      break;
    }
  }

  let detectedChallenge = false;
  let detectedCaptcha = false;
  let detectedLogin = false;
  let challengeType: 'CAPTCHA' | 'WAF' | 'CONSENT' | 'LOGIN' | 'UNKNOWN' | undefined;
  let pageTitle = '';
  let html = '';

  // Se a requisição terminou com sucesso 2xx, fazemos um GET leve para obter o corpo e validar CAPTCHAs/WAF
  if (statusCode && statusCode >= 200 && statusCode < 300) {
    try {
      const finalResponse = await fetch(currentUrl, { 
        method: 'GET',
        headers: BROWSER_HEADERS
      });
      statusCode = finalResponse.status;
      html = await finalResponse.text();
    } catch (e: any) {
      logger.info(`[HTTP Resolver] Falha de conexão ao ler corpo da URL final: ${currentUrl}. Erro: ${e.message}`);
    }
  }

  const lowerHtml = html.toLowerCase();
  const pageTitleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  if (pageTitleMatch) {
    pageTitle = pageTitleMatch[1].trim();
  }
  const pageTitleLower = pageTitle.toLowerCase();
  const lowerUrl = currentUrl.toLowerCase();

  // Mapeamento de WAF/CAPTCHA/Login
  if (statusCode === 202 || lowerHtml.includes('token.awswaf.com') || lowerHtml.includes('awswafintegration')) {
    detectedChallenge = true;
    challengeType = 'WAF';
  } else if (
    lowerHtml.includes('captchacharacters') || 
    lowerHtml.includes('/errors/validatecaptcha') || 
    lowerHtml.includes('g-recaptcha') ||
    pageTitleLower === 'robot check' ||
    pageTitleLower.includes('access denied')
  ) {
    detectedCaptcha = true;
    detectedChallenge = true;
    challengeType = 'CAPTCHA';
  } else if (lowerUrl.includes('/ap/signin') || lowerUrl.includes('/login') || lowerUrl.includes('/signin')) {
    detectedLogin = true;
    detectedChallenge = true;
    challengeType = 'LOGIN';
  }

  // Novo critério objetivo de sucesso:
  // 1. O status code final do redirecionamento ou da URL final deve ser de sucesso (2xx).
  // 2. Não deve ter detectado nenhum desafio de segurança (WAF, CAPTCHA, Login, etc.).
  // 3. A URL final obtida deve ser diferente da URL inicial requisitada.
  // 4. Deve ter ocorrido pelo menos 1 redirecionamento de rede.
  const hasSuccessfulRedirect = redirects.length > 0 && currentUrl !== initialUrlString;
  const isFinalStatusOk = statusCode !== null && statusCode >= 200 && statusCode < 300;
  const resolvedSuccess = isFinalStatusOk && !detectedChallenge && hasSuccessfulRedirect;

  return {
    finalUrl: currentUrl,
    statusCode,
    redirects,
    detectedChallenge,
    detectedCaptcha,
    detectedConsent: false,
    detectedLogin,
    challengeType,
    pageTitle,
    resolvedSuccess
  };
}
