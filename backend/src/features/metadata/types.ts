import { type Static, Type } from '@sinclair/typebox';

export const MetadataRequestSchema = Type.Object({
  url: Type.String({ format: 'uri', minLength: 1 }),
});

export type MetadataRequest = Static<typeof MetadataRequestSchema>;

export const MetadataResponseSchema = Type.Object({
  title: Type.String(),
  description: Type.String(),
  featuredImage: Type.String(),
  domain: Type.String(),
});

export type MetadataResponse = Static<typeof MetadataResponseSchema>;
