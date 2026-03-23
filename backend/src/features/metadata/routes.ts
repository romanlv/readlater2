import type { FastifyPluginAsync } from 'fastify';
import { extractMetadata } from './service.ts';
import { MetadataRequestSchema, MetadataResponseSchema } from './types.ts';

const metadataRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        body: MetadataRequestSchema,
        response: { 200: MetadataResponseSchema },
      },
    },
    async (request, reply) => {
      const { url } = request.body as { url: string };
      const metadata = await extractMetadata(url);
      return reply.send(metadata);
    },
  );
};

export default metadataRoutes;
