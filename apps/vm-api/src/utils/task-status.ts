import { logger } from '@repo/common/logger';
import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface Task {
  taskId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  error?: string;
}

const WORKING_DIRECTORY = process.env.WORKING_DIRECTORY || '/tmp/tasks';
const STATUS_FILE_NAME = 'task-status.json';

/**
 * Get the path to the status file for a given task
 */
function getStatusFilePath(taskId: string): string {
  return join(WORKING_DIRECTORY, `task_${taskId}`, STATUS_FILE_NAME);
}

/**
 * Get the path to the global machine status file
 */
function getMachineStatusPath(): string {
  return join(WORKING_DIRECTORY, 'machine-status.json');
}

/**
 * Write task status to file
 */
export async function writeTaskStatus(taskStatus: Task): Promise<void> {
  try {
    const statusFilePath = getStatusFilePath(taskStatus.taskId);
    await writeFile(statusFilePath, JSON.stringify(taskStatus, null, 2));
    logger.info(`Task status written for ${taskStatus.taskId}:`, taskStatus.status);
  } catch (error) {
    logger.error(`Failed to write task status for ${taskStatus.taskId}:`, error);
    throw error;
  }
}

/**
 * Read task status from file
 */
export async function readTaskStatus(taskId: string): Promise<Task | null> {
  try {
    const statusFilePath = getStatusFilePath(taskId);
    await access(statusFilePath);
    const content = await readFile(statusFilePath, 'utf-8');
    return JSON.parse(content) as Task;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null; // File doesn't exist
    }
    logger.error(`Failed to read task status for ${taskId}:`, error);
    throw error;
  }
}

/**
 * Check if machine is available for new tasks
 */
export async function isMachineAvailable(): Promise<{ available: boolean; currentTask?: Task }> {
  try {
    // Get machine status from global file
    const machineStatusPath = getMachineStatusPath();
    let currentTaskId: string | null = null;

    try {
      await access(machineStatusPath);
      const content = await readFile(machineStatusPath, 'utf-8');
      const machineStatus = JSON.parse(content);
      currentTaskId = machineStatus.currentTaskId;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, machine is available
    }

    if (!currentTaskId) {
      return { available: true };
    }

    // Check if current task is still running
    const taskStatus = await readTaskStatus(currentTaskId);
    if (!taskStatus) {
      // Task status file doesn't exist, clear machine status
      await clearMachineStatus();
      return { available: true };
    }

    if (taskStatus.status === 'running') {
      return { available: false, currentTask: taskStatus };
    } else {
      // Task is finished, clear machine status
      await clearMachineStatus();
      return { available: true };
    }
  } catch (error) {
    logger.error('Failed to check machine availability:', error);
    throw error;
  }
}

/**
 * Set machine as busy with a specific task
 */
export async function setMachineBusy(taskId: string): Promise<void> {
  try {
    const machineStatusPath = getMachineStatusPath();
    const machineStatus = {
      currentTaskId: taskId,
      lastUpdated: new Date().toISOString()
    };
    await writeFile(machineStatusPath, JSON.stringify(machineStatus, null, 2));
    logger.info(`Machine set as busy with task ${taskId}`);
  } catch (error) {
    logger.error(`Failed to set machine busy with task ${taskId}:`, error);
    throw error;
  }
}

/**
 * Clear machine status (set as available)
 */
export async function clearMachineStatus(): Promise<void> {
  try {
    const machineStatusPath = getMachineStatusPath();
    await writeFile(
      machineStatusPath,
      JSON.stringify({ currentTaskId: null, lastUpdated: new Date().toISOString() }, null, 2)
    );
    logger.info('Machine status cleared (set as available)');
  } catch (error) {
    logger.error('Failed to clear machine status:', error);
    throw error;
  }
}

/**
 * Get all task statuses (for debugging/monitoring)
 */
export async function getAllTaskStatuses(): Promise<Task[]> {
  try {
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(WORKING_DIRECTORY, { withFileTypes: true });
    const taskStatuses: Task[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('task_')) {
        const taskId = entry.name.replace('task_', '');
        const status = await readTaskStatus(taskId);
        if (status) {
          taskStatuses.push(status);
        }
      }
    }

    return taskStatuses.sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  } catch (error) {
    logger.error('Failed to get all task statuses:', error);
    throw error;
  }
}
