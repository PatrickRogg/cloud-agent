import { getStatusOfVms as getStatusOfVmsApi } from '@repo/api/vm';
import { loadConfig } from '@utils/config';
import { logError } from '@utils/logger';
import { logStatusOfVms } from './utils';

// VM Status Command
export const vmStatus = async () => {
  const config = loadConfig();

  if (!config) {
    logError('❌', 'Config not found');
    return;
  }

  const result = await getStatusOfVmsApi(config);
  if (result.isErr()) {
    logError('❌', `Failed to get virtual machine status: ${result.error}`);
    return;
  }

  logStatusOfVms(result.value);
};
