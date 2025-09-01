import { loadConfig } from '@repo/common/lib/config';
import { syncVms as syncVmsInfrastructure } from '@repo/infrastructure';
import { logError } from '@utils/logger';
import { logStatusOfVms } from './utils';

export const syncVms = async () => {
  const config = loadConfig();

  if (!config) {
    logError('❌', 'Config not found');
    return;
  }

  try {
    const result = await syncVmsInfrastructure(config);
    logStatusOfVms(result);
  } catch (error) {
    logError('❌', `Failed to sync virtual machines: ${error}`);
  }
};
