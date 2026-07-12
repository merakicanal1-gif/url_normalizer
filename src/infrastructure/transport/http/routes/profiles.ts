import { FastifyInstance } from 'fastify';
import { IProfileManager } from '../../../../domain/ports/IProfileManager.js';
import { AuthenticationService } from '../../../../application/services/AuthenticationService.js';
import { ProfileExportService } from '../../../../application/services/ProfileExportService.js';
import { ProfileImportService } from '../../../../application/services/ProfileImportService.js';
import { ProfileValidationService } from '../../../../application/services/ProfileValidationService.js';
import { AuthenticationSessionService } from '../../../../application/services/AuthenticationSessionService.js';
import { AuthenticationHealthService } from '../../../../application/services/AuthenticationHealthService.js';

export async function profileRoutes(
  fastify: FastifyInstance,
  options: {
    profileManager: IProfileManager;
    authenticationService: AuthenticationService;
    exportService?: ProfileExportService;
    importService?: ProfileImportService;
    validationService?: ProfileValidationService;
    sessionService?: AuthenticationSessionService;
    healthService?: AuthenticationHealthService;
  }
) {
  const { 
    profileManager, 
    authenticationService,
    exportService,
    importService,
    validationService,
    sessionService,
    healthService
  } = options;

  // Registrar parser para upload binário (.profile)
  if (!fastify.hasContentTypeParser('application/octet-stream')) {
    fastify.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (req, body, done) => {
      done(null, body);
    });
  }

  fastify.post('/sessions', async (request, reply) => {
    const { marketplace, profileId, createdBy } = request.body as any;
    if (!marketplace || !profileId) {
      return reply.status(400).send({ success: false, error: 'Campos "marketplace" e "profileId" são obrigatórios.' });
    }
    try {
      const profile = await profileManager.createProfile(marketplace, profileId, createdBy);
      return reply.status(201).send({ success: true, data: profile });
    } catch (err: any) {
      return reply.status(409).send({ success: false, error: err.message });
    }
  });

  fastify.get('/sessions', async (request, reply) => {
    try {
      const list = await profileManager.listProfiles();
      return reply.status(200).send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  fastify.get('/profiles', async (request, reply) => {
    try {
      const list = await profileManager.listProfiles();
      return reply.status(200).send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  fastify.get('/profiles/:marketplace', async (request, reply) => {
    const { marketplace } = request.params as any;
    try {
      const list = await profileManager.listProfiles(marketplace);
      return reply.status(200).send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  fastify.get('/profiles/:marketplace/:profile', async (request, reply) => {
    const { marketplace, profile } = request.params as any;
    try {
      const data = await profileManager.getProfile(marketplace, profile);
      if (!data) {
        return reply.status(404).send({ success: false, error: 'Profile not found.' });
      }
      return reply.status(200).send({ success: true, data });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  fastify.delete('/profiles/:marketplace/:profile', async (request, reply) => {
    const { marketplace, profile } = request.params as any;
    try {
      await profileManager.deleteProfile(marketplace, profile);
      return reply.status(200).send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  fastify.post('/profiles/:marketplace/:profile/authenticate', async (request, reply) => {
    const { marketplace, profile } = request.params as any;
    const traceId = (request.headers['x-trace-id'] as string) || (request.headers['traceparent'] as string) || null;
    const requestId = (request.headers['x-request-id'] as string) || request.id || null;

    try {
      const data = await authenticationService.authenticate(marketplace, profile, traceId, requestId);
      return reply.status(200).send({
        success: true,
        data
      });
    } catch (err: any) {
      fastify.log.error(err, `Erro ao disparar autenticação para ${marketplace}/${profile}`);
      const isUnavailable = err.message === 'INTERACTIVE_AUTHENTICATION_UNAVAILABLE' || err.message.includes('INTERACTIVE_AUTHENTICATION_UNAVAILABLE');
      return reply.status(isUnavailable ? 400 : 500).send({
        success: false,
        error: {
          code: isUnavailable ? 'INTERACTIVE_AUTHENTICATION_UNAVAILABLE' : 'AUTHENTICATION_INIT_FAILED',
          message: isUnavailable ? 'O navegador interativo está desabilitado neste ambiente servidor.' : err.message
        }
      });
    }
  });

  fastify.post('/profiles/:marketplace/:profile/authenticate/:authenticationId/finish', async (request, reply) => {
    const { marketplace, profile, authenticationId } = request.params as any;

    try {
      const data = await authenticationService.finishAuthentication(marketplace, profile, authenticationId);
      return reply.status(200).send(data);
    } catch (err: any) {
      if (err.statusCode === 404 || err.message.includes('not found') || err.message.includes('Não encontrado')) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'AUTHENTICATION_NOT_FOUND',
            message: err.message
          }
        });
      }
      fastify.log.error(err, `Erro ao finalizar autenticação ${authenticationId} para ${marketplace}/${profile}`);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'AUTHENTICATION_FINISH_FAILED',
          message: err.message
        }
      });
    }
  });

  // Novos endpoints do subsistema profissional de perfis e sessões

  fastify.get('/profiles/:marketplace/:profile/export', async (request, reply) => {
    const { marketplace, profile } = request.params as any;
    if (!exportService) {
      return reply.status(501).send({ success: false, error: 'Export service not configured.' });
    }
    try {
      const buffer = await exportService.exportProfile(marketplace, profile);
      return reply
        .header('Content-Disposition', `attachment; filename="${marketplace.toLowerCase()}-${profile}.profile"`)
        .header('Content-Type', 'application/octet-stream')
        .send(buffer);
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  fastify.post('/profiles/import', async (request, reply) => {
    if (!importService) {
      return reply.status(501).send({ success: false, error: 'Import service not configured.' });
    }
    const buffer = request.body as Buffer;
    if (!buffer || buffer.length === 0) {
      return reply.status(400).send({ success: false, error: 'Request body must be a binary .profile file.' });
    }
    try {
      const result = await importService.importProfile(buffer);
      return reply.status(200).send({ success: true, data: result });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message });
    }
  });

  fastify.get('/profiles/:marketplace/:profile/status', async (request, reply) => {
    const { marketplace, profile } = request.params as any;
    if (!sessionService) {
      return reply.status(501).send({ success: false, error: 'Session service not configured.' });
    }
    try {
      const diagnostic = await sessionService.getDiagnostic(marketplace, profile);
      return reply.status(200).send({ success: true, data: diagnostic });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  fastify.get('/profiles/:marketplace/:profile/validate', async (request, reply) => {
    const { marketplace, profile } = request.params as any;
    if (!validationService) {
      return reply.status(501).send({ success: false, error: 'Validation service not configured.' });
    }
    try {
      const result = await validationService.validateProfile(marketplace, profile);
      return reply.status(200).send({ success: true, data: result });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  fastify.post('/profiles/:marketplace/:profile/refresh', async (request, reply) => {
    const { marketplace, profile } = request.params as any;
    if (!healthService) {
      return reply.status(501).send({ success: false, error: 'Health service not configured.' });
    }
    try {
      const result = await healthService.refreshSession(marketplace, profile);
      return reply.status(200).send({ success: true, data: result });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
}
