import { syncVms as syncVmsApi } from '@repo/api/vm';
import { logError } from '@utils/logger';
import { loadConfig } from '../utils/config';
import { logStatusOfVms } from './utils';

export const syncVms = async () => {
  const config = loadConfig();

  if (!config) {
    logError('❌', 'Config not found');
    return;
  }

  const result = await syncVmsApi(config.vm);
  if (result.isErr()) {
    logError('❌', `Failed to sync virtual machines: ${JSON.stringify(result.error)}`);
    return;
  }

  logStatusOfVms(result.value);
};
