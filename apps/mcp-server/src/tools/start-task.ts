import { logger } from '@repo/common/logger';
import { TaskStatus } from '@repo/database/types';
import { getVms } from '@repo/infrastructure';
import { z } from 'zod/v3';
import { createMcpTool } from '../types/mcp.js';
import { config } from '../utils/config.js';
import { db } from '../utils/db.js';

const inputSchema = {
  instructions: z.string().describe('The instructions or description of the task to be executed')
};

const outputSchema = {
  taskId: z.string().describe('The unique identifier of the created task'),
  status: z.string().describe('The final status of the task'),
  message: z.string().describe('A confirmation message')
};

export const startTaskTool = createMcpTool({
  name: 'start-task',
  title: 'Start Task',
  description: 'Creates and immediately executes a task on an available VM',
  inputSchema,
  outputSchema,
  callback: async args => {
    try {
      // Create task in database
      const task = await db.task.create({
        data: {
          instructions: args.instructions,
          status: TaskStatus.QUEUED
        }
      });

      logger.info(`Created task ${task.id}, looking for available VMs...`);

      // Fetch VMs from infrastructure
      const vms = await getVms(config);

      // Filter VMs that are running and have healthy API status
      const availableVms = vms.filter(
        vm => vm.status === 'running' && vm.apiStatus === 'healthy' && vm.ip
      );

      if (availableVms.length === 0) {
        // Update task status to failed
        await db.task.update({
          where: { id: task.id },
          data: { status: TaskStatus.FAILED }
        });

        return {
          content: [
            {
              type: 'text',
              text: `No available VMs found. Task "${task.id}" could not be scheduled.`
            }
          ],
          structuredContent: {
            taskId: task.id,
            status: TaskStatus.FAILED,
            message: 'No available VMs found for task execution'
          },
          isError: true
        };
      }

      // Retry scheduling for up to 5 minutes
      const maxRetryDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
      const retryDelay = 5000; // 5 seconds between retries
      const startTime = Date.now();
      let retryCount = 0;

      while (Date.now() - startTime < maxRetryDuration) {
        retryCount++;
        logger.info(`Scheduling attempt ${retryCount} for task ${task.id}...`);

        // Try to schedule on available VMs
        for (const vm of availableVms) {
          logger.info(`Checking availability of VM ${vm.name} (${vm.ip})`);

          const isVmAvailable = await checkVmAvailability(vm.ip!);
          if (isVmAvailable) {
            logger.info(`Scheduling task ${task.id} on VM ${vm.name}`);

            try {
              await scheduleTaskOnVm(task, vm.ip!);

              return {
                content: [
                  {
                    type: 'text',
                    text: `Task "${task.id}" has been scheduled and started on VM ${vm.name} (after ${retryCount} attempt${retryCount > 1 ? 's' : ''}).`
                  }
                ],
                structuredContent: {
                  taskId: task.id,
                  status: TaskStatus.RUNNING,
                  message: `Task successfully scheduled and started on VM ${vm.name} after ${retryCount} attempt${retryCount > 1 ? 's' : ''}`
                }
              };
            } catch (vmError) {
              logger.error(`Failed to schedule task on VM ${vm.name}:`, vmError);
              // Continue to try next VM
            }
          }
        }

        // Check if we have time for another retry
        const remainingTime = maxRetryDuration - (Date.now() - startTime);
        if (remainingTime < retryDelay) {
          logger.info(`Not enough time remaining (${Math.round(remainingTime / 1000)}s) for another retry attempt`);
          break;
        }

        logger.info(`All VMs busy, retrying in ${retryDelay / 1000} seconds... (${Math.round(remainingTime / 1000)}s remaining)`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        // Refresh VM list for next attempt
        const refreshedVms = await getVms(config);
        availableVms.length = 0;
        availableVms.push(...refreshedVms.filter(
          vm => vm.status === 'running' && vm.apiStatus === 'healthy' && vm.ip
        ));

        if (availableVms.length === 0) {
          logger.warn(`No available VMs found on retry attempt ${retryCount}`);
          // Continue retrying - VMs might come online
        }
      }

      // If we get here, we've exhausted all retry attempts
      await db.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.FAILED }
      });

      const totalTimeSpent = Math.round((Date.now() - startTime) / 1000);
      logger.error(`Failed to schedule task ${task.id} after ${retryCount} attempts over ${totalTimeSpent} seconds`);

      return {
        content: [
          {
            type: 'text',
            text: `Task "${task.id}" could not be scheduled after ${retryCount} attempts over ${Math.round(totalTimeSpent / 60)} minutes - all VMs remained busy or unavailable.`
          }
        ],
        structuredContent: {
          taskId: task.id,
          status: TaskStatus.FAILED,
          message: `Task scheduling failed after ${retryCount} retry attempts over ${Math.round(totalTimeSpent / 60)} minutes`
        },
        isError: true
      };
    } catch (error) {
      logger.error('Failed to start task:', error);

      return {
        content: [
          {
            type: 'text',
            text: `Failed to start task: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ],
        structuredContent: {
          taskId: '',
          status: '',
          message: ''
        },
        isError: true
      };
    }
  }
});

/**
 * Check if a VM is available for scheduling tasks
 */
async function checkVmAvailability(vmIp: string): Promise<boolean> {
  try {
    const response = await fetch(`http://${vmIp}:7000/machine/availability`, {
      headers: {
        'x-api-key': config.vm.apiKey
      }
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { available: boolean };
    return data.available === true;
  } catch (error) {
    logger.error(`Failed to check VM availability for ${vmIp}:`, error);
    return false;
  }
}

/**
 * Schedule a task on a specific VM and wait for it to start running
 */
async function scheduleTaskOnVm(
  task: { id: string; instructions: string },
  vmIp: string
): Promise<void> {
  const response = await fetch(`http://${vmIp}:7000/task/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.vm.apiKey
    },
    body: JSON.stringify({
      task
    })
  });

  if (!response.ok) {
    throw new Error(`VM API returned ${response.status}: ${response.statusText}`);
  }

  // The VM API streams the response, but we just need to wait for the initial status
  // indicating the task has started
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body from VM API');
  }

  try {
    let hasStarted = false;
    const decoder = new TextDecoder();

    while (!hasStarted) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          if (message.type === 'status' && message.message?.includes('Starting')) {
            hasStarted = true;
            break;
          }
        } catch (parseError) {
          // Skip non-JSON lines
        }
      }
    }

    if (hasStarted) {
      await db.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.RUNNING }
      });
    }
  } finally {
    reader.releaseLock();
  }
}
