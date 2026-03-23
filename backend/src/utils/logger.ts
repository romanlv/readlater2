import pino from 'pino';
import { config } from '../config.ts';

const loggerConfig = {
  level: config.isTest ? 'silent' : config.isDev ? 'debug' : 'info',
  transport: config.isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true },
      }
    : undefined,
};

export const logger = pino(loggerConfig);

export const fastifyLogger = config.isTest ? false : loggerConfig;
