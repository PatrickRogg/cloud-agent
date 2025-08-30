import { logger } from '@repo/common/logger';
import { VirtualMachine } from '@repo/common/types/vm';

export const logStatusOfVms = (vms: VirtualMachine[]) => {
  if (vms.length === 0) {
    logger.info(`\n📊 Virtual Machine Status: No VMs found`);
    return;
  }

  // Calculate dynamic column widths based on content
  const idWidth = Math.max(2, ...vms.map(vm => vm.id.length));
  const nameWidth = Math.max(4, ...vms.map(vm => vm.name.length));
  const statusWidth = Math.max(6, ...vms.map(vm => vm.status.length)) + 4; // +2 for icon and space
  const ipWidth = Math.max(10, ...vms.map(vm => (vm.ip ?? 'N/A').length));

  // Helper function to create border lines
  const createBorder = (chars: [string, string, string, string]) => {
    return chars[0] + 
           chars[1].repeat(idWidth + 2) + chars[2] +
           chars[1].repeat(nameWidth + 2) + chars[2] +
           chars[1].repeat(statusWidth + 2) + chars[2] +
           chars[1].repeat(ipWidth + 2) + chars[3];
  };

  // Status icon mapping
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return '🟢';
      case 'creating': return '🔵';
      case 'stopped': return '🟡';
      case 'error': return '🔴';
      case 'deleted': return '⚫';
      default: return '🔴';
    }
  };

  logger.info(`\n📊 Virtual Machine Status:`);
  logger.info(createBorder(['┌', '─', '┬', '┐']));
  logger.info(
    `│ ${'ID'.padEnd(idWidth)} │ ${'Name'.padEnd(nameWidth)} │ ${'Status'.padEnd(statusWidth)} │ ${'IP Address'.padEnd(ipWidth)} │`
  );
  logger.info(createBorder(['├', '─', '┼', '┤']));
  
  vms.forEach(vm => {
    const statusIcon = getStatusIcon(vm.status);
    const statusText = `${statusIcon} ${vm.status}`;
    logger.info(
      `│ ${vm.id.padEnd(idWidth)} │ ${vm.name.padEnd(nameWidth)} │ ${statusText.padEnd(statusWidth)} │ ${(vm.ip ?? 'N/A').padEnd(ipWidth)} │`
    );
  });
  
  logger.info(createBorder(['└', '─', '┴', '┘']));
};
