import { CloudProviderConfig } from '@repo/common/types/config';
import { HetznerProvider } from './hetzner';

export const getProviderFromConfig = (config: CloudProviderConfig) => {
  if (config.name === 'hetzner') {
    return new HetznerProvider(config.config);
  }

  throw new Error(`Unknown provider: ${config}`);
};
