import { FastifyInstance } from 'fastify';
import { IProfileManager } from '../../../../domain/ports/IProfileManager.js';
import { AuthenticationService } from '../../../../application/services/AuthenticationService.js';

export async function profileRoutes(
  fastify: FastifyInstance,
  options: {
    profileManager: IProfileManager;
    authenticationService: AuthenticationService;
  }
) {
  const { profileManager, authenticationService } = options;

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
      return reply.status(500).send({
        success: false,
        error: {
          code: 'AUTHENTICATION_INIT_FAILED',
          message: err.message
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
}
