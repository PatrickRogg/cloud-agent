import { logger } from '@repo/common/logger';

export const logInfo = (prefix: string, message: string) => {
  logger.info(`${prefix} ${message}`);
};

export const logDebug = (prefix: string, message: string) => {
  logger.debug(`${prefix} ${message}`);
};

export const logWarning = (prefix: string, message: string) => {
  logger.warn(`${prefix} ${message}`);
};

export const logError = (prefix: string, message: string) => {
  logger.error(`${prefix} ${message}`);
};
