import { loadOrCreateDefaultConfig } from '@repo/common/lib/config';

export const init = async () => {
  await loadOrCreateDefaultConfig();
};
