import { Config, configSchema } from '@repo/common/types/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { z } from 'zod';
import { logError, logInfo, logWarning } from './logger';
import { generateApiKey } from '@repo/common/lib/api-key';

const DEFAULT_CONFIG_PATH = '.cloudagent/config.json';

export const loadConfig = (): Config | null => {
  const resolvedPath = resolve(DEFAULT_CONFIG_PATH);

  if (!existsSync(resolvedPath)) {
    logWarning('⚠️', `Config file not found at: ${resolvedPath}`);
    return null;
  }

  try {
    const configContent = readFileSync(resolvedPath, 'utf-8');
    const config = configSchema.parse(JSON.parse(configContent));
    logInfo('📁', `Loaded config from: ${resolvedPath}`);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logError('❌', `Error loading config file: ${error.message}`);
      throw new Error(`Error loading config file: ${error.message}`);
    }
    logError('❌', `Error loading config file: ${error}`);
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
  logInfo('✨', 'Creating default config...');
  mkdirSync(dirname(DEFAULT_CONFIG_PATH), { recursive: true });
  writeFileSync(DEFAULT_CONFIG_PATH, JSON.stringify(config, null, 2));
  logInfo('📁', `Created default config at: ${DEFAULT_CONFIG_PATH}`);
  return config;
};

export const loadOrCreateDefaultConfig = async (): Promise<Config> => {
  const config = loadConfig();

  if (config) {
    return config;
  }

  return await createDefaultConfig();
};
