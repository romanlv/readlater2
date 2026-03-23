import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify, { type FastifyError } from 'fastify';
import { config } from './config.ts';
import metadataRoutes from './features/metadata/routes.ts';
import { AppError } from './lib/errors.ts';
import { fastifyLogger } from './utils/logger.ts';

export async function buildServer() {
  const fastify = Fastify({
    logger: fastifyLogger,
    genReqId: () => randomUUID(),
  }).withTypeProvider<TypeBoxTypeProvider>();

  // --- Plugins ---
  await fastify.register(cors, {
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });

  // --- Error handler ---
  fastify.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    const statusCode =
      error instanceof AppError
        ? error.statusCode
        : 'statusCode' in error
          ? (error.statusCode ?? 500)
          : 500;

    if (statusCode >= 500) {
      request.log.error(error);
    }

    if ('validation' in error && error.validation) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: error.message,
      });
    }

    return reply.status(statusCode).send({
      error: error.name,
      message: error.message,
    });
  });

  // --- Routes ---
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // --- Feature routes ---
  await fastify.register(metadataRoutes, { prefix: '/api/metadata' });

  return fastify;
}
