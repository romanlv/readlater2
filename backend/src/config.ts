const nodeEnv = process.env.NODE_ENV ?? 'development';

export const config = {
  nodeEnv,
  isDev: nodeEnv === 'development',
  isTest: nodeEnv === 'test',

  server: {
    port: Number(process.env.PORT ?? 4080),
    host: process.env.HOST ?? '0.0.0.0',
  },

  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3030',
  },

  metadata: {
    fetchTimeoutMs: Number(process.env.METADATA_FETCH_TIMEOUT_MS ?? 10_000),
    maxResponseBytes: Number(process.env.METADATA_MAX_RESPONSE_BYTES ?? 5 * 1024 * 1024),
  },
};
