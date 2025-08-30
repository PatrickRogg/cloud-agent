import { logError } from '@utils/logger';
import { Command } from 'commander';
import { init } from './init';
import { destroyVms } from './vm/destroy';
import { vmStatus } from './vm/status';
import { syncVms } from './vm/sync';

const program = new Command();

program
  .name('ca')
  .description('CloudAgent CLI - Manage your cloud infrastructure')
  .version('0.0.1');

const initCommand = program.command('init').description('Initialize Cloud Agent');

initCommand.action(async () => {
  try {
    await init();
  } catch (error) {
    logError(
      '❌',
      `Failed to initialize Cloud Agent: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});

const vmCommand = program.command('vm').description('Virtual machine management commands');

vmCommand
  .command('status')
  .description('Show status of all virtual machines')
  .action(async () => {
    try {
      await vmStatus();
    } catch (error) {
      logError(
        '❌',
        `Failed to get virtual machine status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

vmCommand
  .command('sync')
  .description('Sync virtual machines from config')
  .action(async () => {
    try {
      await syncVms();
    } catch (error) {
      logError(
        '❌',
        `Failed to sync virtual machines: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

vmCommand
  .command('destroy')
  .description('Destroy virtual machines from config')
  .action(async () => {
    try {
      await destroyVms();
    } catch (error) {
      logError(
        '❌',
        `Failed to destroy virtual machines: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

program.parse();
