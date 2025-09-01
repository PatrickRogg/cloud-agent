import { loadConfig } from '@repo/common/lib/config';

const loadConfigOrThrow = () => {
  const config = loadConfig();
  if (!config) {
    throw new Error('Config not found');
  }
  return config;
};

export const config = loadConfigOrThrow();
