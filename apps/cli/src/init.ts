import { loadOrCreateDefaultConfig } from '@utils/config';

export const init = async () => {
  await loadOrCreateDefaultConfig();
};
