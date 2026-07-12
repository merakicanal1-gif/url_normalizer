import { FastifyInstance } from 'fastify';
import { NormalizeService } from '../../../../application/services/NormalizeService.js';
import { normalizeSchema } from '../schemas/normalizeSchema.js';
import { ChallengeDetectedError } from '../../../../domain/errors/ChallengeDetectedError.js';
import { MarketplaceUnavailableError } from '../../../../domain/errors/MarketplaceUnavailableError.js';
import { IAuthenticationStatusResolver } from '../../../../domain/ports/IAuthenticationStatusResolver.js';

export async function normalizeRoutes(
  fastify: FastifyInstance,
  options: { 
    normalizeService: NormalizeService;
    statusResolver?: IAuthenticationStatusResolver;
  }
) {
  const { normalizeService, statusResolver } = options;

  fastify.post('/normalize', async (request, reply) => {
    // 1. Validar entrada utilizando Zod de forma explícita
    const bodyParse = normalizeSchema.safeParse(request.body);
    if (!bodyParse.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: bodyParse.error.errors[0].message
        }
      });
    }

    const { url } = bodyParse.data;
    const profileId = (request.headers['x-profile-id'] as string) || (request.body as any)?.profileId;
    const start = performance.now();

    try {
      fastify.log.info({ url, profileId }, 'Iniciando normalização de URL');

      const traceId = (request.headers['x-trace-id'] as string) || (request.headers['traceparent'] as string) || null;
      const requestId = (request.headers['x-request-id'] as string) || request.id || null;

      // 2. Chamar o serviço de aplicação de normalização com telemetria
      const result = await normalizeService.normalize(url, profileId, traceId, requestId);

      const end = performance.now();
      const durationMs = Math.round(end - start);

      fastify.log.info(
        { url, marketplace: result.marketplace, durationMs },
        'Normalização concluída com sucesso'
      );

      // 3. Retornar a resposta estruturada de sucesso
      return reply.status(200).send({
        success: true,
        marketplace: result.marketplace,
        url_final: result.url_final,
        id_produto: result.id_produto,
        titulo: result.titulo,
        imagem: result.imagem,
        execution: {
          duration_ms: durationMs
        }
      });
    } catch (error: any) {
      const end = performance.now();
      const durationMs = Math.round(end - start);
      
      fastify.log.error(
        { url, err: error.message, durationMs },
        'Falha operacional durante a normalização'
      );

      // 4. Determinar código de erro e status HTTP apropriados
      let statusCode = 500;
      let errorCode = 'INTERNAL_ERROR';

      if (error instanceof ChallengeDetectedError) {
        statusCode = 403; // Forbidden
        errorCode = `CHALLENGE_${error.type}`;
        if (error.type === 'LOGIN') {
          errorCode = 'SESSION_EXPIRED';
        }
      } else if (error instanceof MarketplaceUnavailableError) {
        statusCode = 503; // Service Unavailable
        errorCode = 'MARKETPLACE_ERROR_PAGE';
      } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        statusCode = 408;
        errorCode = 'NAVIGATION_TIMEOUT';
      } else if (error.message.includes('Marketplace não suportado')) {
        statusCode = 400;
        errorCode = 'MARKETPLACE_NOT_SUPPORTED';
      } else if (error.message.includes('Não foi possível identificar o código')) {
        statusCode = 422;
        errorCode = 'UNSUPPORTED_PRODUCT_URL';
      } else if (error.message.includes('CDP') || error.message.includes('BrowserContext')) {
        statusCode = 502;
        errorCode = 'BROWSER_CONNECTION_ERROR';
      } else {
        statusCode = 500;
        errorCode = 'NAVIGATION_ERROR';
      }

      // 5. Se um perfil de autenticação foi fornecido, anexar o bloco de status
      let authBlock: any = undefined;
      if (profileId && statusResolver) {
        try {
          let mkt = 'generic';
          const targetUrl = new URL(url);
          if (targetUrl.hostname.includes('amazon')) mkt = 'amazon';
          else if (targetUrl.hostname.includes('mercadolivre') || targetUrl.hostname.includes('mercadolibre') || targetUrl.hostname.includes('meli.la')) mkt = 'mercadolivre';
          else if (targetUrl.hostname.includes('shopee')) mkt = 'shopee';

          const diag = await statusResolver.resolveStatus(mkt, profileId);
          authBlock = {
            marketplace: diag.marketplace,
            profileId: diag.profileId,
            status: diag.status,
            authenticated: diag.authenticated,
            recommendedAction: diag.recommendedAction,
            lastSuccessfulNormalize: diag.lastSuccessfulNormalize,
            profileVersion: diag.profileVersion
          };
        } catch (e) {
          // Ignorar erros na resolução do bloco
        }
      }

      return reply.status(statusCode).send({
        success: false,
        error: {
          code: errorCode,
          message: error.message || 'Erro desconhecido durante a navegação.'
        },
        authentication: authBlock,
        execution: {
          duration_ms: durationMs
        }
      });
    }
  });
}
