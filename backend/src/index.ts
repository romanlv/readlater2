import { config } from './config.ts';
import { buildServer } from './server.ts';
import { logger } from './utils/logger.ts';

const server = await buildServer();

try {
  await server.listen({
    port: config.server.port,
    host: config.server.host,
  });
  logger.info(
    `Server listening on http://${config.server.host}:${config.server.port}`,
  );
} catch (err) {
  logger.fatal(err, 'Failed to start server');
  process.exit(1);
}

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down...');
  await server.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
