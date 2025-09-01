import { destroyVms as destroyVmsApi } from '@repo/api/vm';
import { logError, logInfo } from '@utils/logger';
import { loadConfig } from '../utils/config';
import { logStatusOfVms } from './utils';

export const destroyVms = async () => {
  const config = loadConfig();

  if (!config) {
    logError('❌', 'Config not found');
    return;
  }

  const result = await destroyVmsApi(config);
  if (result.isErr()) {
    logError('❌', `Failed to destroy virtual machines: ${result.error}`);
    return;
  }

  logInfo('✅', 'Virtual machines destroyed successfully');
  logStatusOfVms(result.value);
};
