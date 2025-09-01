import { Config, VmConfig } from '@repo/common/types/config';
import { VirtualMachine } from '@repo/common/types/vm';
import {
  destroyVms as destroyVmsInfrastructure,
  getVms,
  syncVms as syncVmsInfrastructure
} from '@repo/infrastructure';
import { Result, err, ok } from 'neverthrow';
import { ErrorResult } from '../utils/error';

export const syncVms = async (config: Config): Promise<Result<VirtualMachine[], ErrorResult>> => {
  try {
    const result = await syncVmsInfrastructure(config);
    return ok(result);
  } catch (error) {
    return err({
      message: `Failed to sync virtual machines: ${error instanceof Error ? error.message : 'Unknown error'}`,
      code: 'VM_SYNC_FAILED'
    });
  }
};

export const destroyVms = async (
  config: Config
): Promise<Result<VirtualMachine[], ErrorResult>> => {
  try {
    const result = await destroyVmsInfrastructure(config);
    return ok(result);
  } catch (error) {
    return err({
      message: `Failed to destroy virtual machines: ${error instanceof Error ? error.message : 'Unknown error'}`,
      code: 'VM_DESTROY_FAILED'
    });
  }
};

export const getStatusOfVms = async (
  config: Config
): Promise<Result<VirtualMachine[], ErrorResult>> => {
  try {
    const result = await getVms(config);
    return ok(result);
  } catch (error) {
    return err({
      message: `Failed to get status of virtual machines: ${error instanceof Error ? error.message : 'Unknown error'}`,
      code: 'VM_STATUS_FAILED'
    });
  }
};
