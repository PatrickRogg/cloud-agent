import { VmConfig } from '@repo/common/types/config';
import { VirtualMachine } from '@repo/common/types/vm';
import { getProviderFromConfig } from './cloud-providers';

export const syncVms = async (config: VmConfig): Promise<VirtualMachine[]> => {
  const allVms = await getVms(config);

  const vmsToDestroy = allVms.filter(
    vm => !config.instances.some(instance => instance.name === vm.name)
  );
  await Promise.all(
    vmsToDestroy.map(vm => {
      const providerConfig = config.providers.find(provider => vm.provider === provider.name);
      if (!providerConfig) {
        throw new Error(`Provider ${vm.provider} not found`);
      }
      const provider = getProviderFromConfig(providerConfig);
      return provider.deleteVm(vm.id);
    })
  );

  const vmsToCreate = config.instances.filter(
    instance => !allVms.some(vm => vm.name === instance.name)
  );
  await Promise.all(
    vmsToCreate.map(instance => {
      const providerConfig = config.providers.find(provider => provider.name === instance.provider);
      if (!providerConfig) {
        throw new Error(`Provider ${instance.provider} not found`);
      }
      const provider = getProviderFromConfig(providerConfig);
      return provider.createVm({ ...instance, sshKey: config.sshKey, vmApiKey: config.apiKey });
    })
  );

  return await getVms(config);
};

export const destroyVms = async (config: VmConfig) => {
  const allVms = await getVms(config);
  await Promise.all(
    allVms.map(vm => {
      const providerConfig = config.providers.find(provider => vm.provider === provider.name);
      if (!providerConfig) {
        return;
      }
      const provider = getProviderFromConfig(providerConfig);
      return provider.deleteVm(vm.id);
    })
  );
  return await getVms(config);
};

export const getVms = async (config: VmConfig): Promise<VirtualMachine[]> => {
  const allVms = (
    await Promise.all(
      config.providers.map(async providerConfig => {
        const provider = getProviderFromConfig(providerConfig);
        return provider.listVms();
      })
    )
  ).flat();
  return allVms;
};
