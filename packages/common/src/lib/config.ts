import { generateApiKey } from '@repo/common/lib/api-key';
import { Config, configSchema } from '@repo/common/types/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, resolve } from 'path';
import { z } from 'zod';
import { logger } from '../logger';

const DEFAULT_CONFIG_PATH = '~/.cloudagent/config.json';

const expandTildePath = (path: string): string => {
  return path.startsWith('~') ? path.replace('~', homedir()) : path;
};

export const loadConfig = (): Config | null => {
  const resolvedPath = resolve(expandTildePath(DEFAULT_CONFIG_PATH));

  if (!existsSync(resolvedPath)) {
    logger.warn(`⚠️ Config file not found at: ${resolvedPath}`);
    return null;
  }

  try {
    const configContent = readFileSync(resolvedPath, 'utf-8');
    const config = configSchema.parse(JSON.parse(configContent));
    logger.info(`📁 Loaded config from: ${resolvedPath}`);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error(`❌ Error loading config file: ${error.message}`);
      throw new Error(`Error loading config file: ${error.message}`);
    }
    logger.error(`❌ Error loading config file: ${error}`);
    throw new Error(`Error loading config file: ${error}`);
  }
};

const createDefaultConfig = async (): Promise<Config> => {
  const config: Config = {
    version: '0.0.1',
    auth: {
      anthropic: {
        claudeDirectory: '~/.claude'
      }
    },
    vm: {
      sshKey: '~/.ssh/id_ed25519',
      apiKey: generateApiKey('sk'),
      providers: [
        {
          name: 'hetzner',
          config: {
            token: 'my-hcloud-token'
          }
        }
      ],
      instances: [
        {
          name: 'my-cloud-agent-vm-cpx11',
          instanceType: 'cpx11',
          region: 'fsn1',
          provider: 'hetzner'
        }
      ]
    }
  };
  logger.info('✨ Creating default config...');
  const resolvedPath = resolve(expandTildePath(DEFAULT_CONFIG_PATH));
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, JSON.stringify(config, null, 2));
  logger.info(`📁 Created default config at: ${resolvedPath}`);
  return config;
};

export const loadOrCreateDefaultConfig = async (): Promise<Config> => {
  const config = loadConfig();

  if (config) {
    return config;
  }

  return await createDefaultConfig();
};
