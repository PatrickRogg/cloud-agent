import { getVms } from '@repo/infrastructure';
import { loadConfig } from '@repo/common/lib/config';
import { logError } from '@utils/logger';
import { logStatusOfVms } from './utils';

// VM Status Command
export const vmStatus = async () => {
  const config = loadConfig();

  if (!config) {
    logError('❌', 'Config not found');
    return;
  }

  try {
    const result = await getVms(config);
    logStatusOfVms(result);
  } catch (error) {
    logError('❌', `Failed to get virtual machine status: ${error}`);
    return;
  }
};
