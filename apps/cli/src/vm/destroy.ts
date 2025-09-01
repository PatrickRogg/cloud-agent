import { destroyVms as destroyVmsInfrastructure } from '@repo/infrastructure';
import { logError, logInfo } from '@utils/logger';
import { loadConfig } from '@repo/common/lib/config';
import { logStatusOfVms } from './utils';

export const destroyVms = async () => {
  const config = loadConfig();

  if (!config) {
    logError('❌', 'Config not found');
    return;
  }

  try {
    const result = await destroyVmsInfrastructure(config);
    logStatusOfVms(result);
    logInfo('✅', 'Virtual machines destroyed successfully');
  } catch (error) {
    logError('❌', `Failed to destroy virtual machines: ${error}`);
  }
};
