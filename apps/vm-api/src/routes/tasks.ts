import { query } from '@anthropic-ai/claude-code';
import { zValidator } from '@hono/zod-validator';
import { logger } from '@repo/common/logger';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { mkdir } from 'node:fs/promises';
import { z } from 'zod';
import {
  clearMachineStatus,
  getAllTaskStatuses,
  isMachineAvailable,
  readTaskStatus,
  setMachineBusy,
  writeTaskStatus,
  type Task
} from '../utils/task-status';

export const taskRouter = new Hono();

const runTaskSchema = z.object({
  task: z.object({
    id: z.string().min(1, 'Task ID is required'),
    instructions: z.string().min(1, 'Instructions are required')
  }),
  agent: z.object({
    options: z
      .object({
        maxTurns: z.number().int().min(1).max(20).default(5),
        allowedTools: z
          .array(z.enum(['Bash', 'Read', 'Write', 'WebSearch', 'Edit']))
          .default(['Bash', 'Read', 'WebSearch'])
          .optional(),
        timeout: z
          .number()
          .int()
          .min(60_000)
          .max(20 * 60_000)
          .default(60_000) // 1 minute to 20 minutes,
      })
      .optional()
  })
});

taskRouter.post('/task/run', zValidator('json', runTaskSchema), async c => {
  const { task, agent } = c.req.valid('json');

  try {
    const { available, currentTask } = await isMachineAvailable();
    if (!available) {
      return c.json(
        {
          error: 'Machine is busy',
          currentTask: currentTask
        },
        409
      );
    }
  } catch (error) {
    logger.error('Failed to check machine availability:', error);
    return c.json({ error: 'Failed to check machine availability' }, 500);
  }

  return stream(c, async stream => {
    const abortController = new AbortController();
    let taskStarted = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, agent.options?.timeout);

    // Handle abort events
    stream.onAbort(async () => {
      logger.info('Stream aborted by client');
      abortController.abort();

      if (taskStarted) {
        try {
          // Update task status to cancelled
          await writeTaskStatus({
            taskId: task.id,
            status: 'cancelled',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            error: 'Task cancelled'
          });
          await clearMachineStatus();
        } catch (error) {
          logger.error('Failed to update task status on abort:', error);
        }
      }
    });

    try {
      // Set machine as busy and initialize task status
      await setMachineBusy(task.id);

      const initialTaskStatus: Task = {
        taskId: task.id,
        status: 'running',
        startTime: new Date().toISOString()
      };
      await writeTaskStatus(initialTaskStatus);
      taskStarted = true;

      // Send initial status
      const initialMessage =
        JSON.stringify({
          type: 'status',
          message: 'Starting Claude code execution...',
          timestamp: new Date().toISOString()
        }) + '\n';
      await stream.write(new TextEncoder().encode(initialMessage));

      let messageCount = 0;
      let hasResult = false;
      let lastError: string | undefined;

      const cwd = `${process.env.WORKING_DIRECTORY}/${task.id}`;
      await mkdir(cwd, { recursive: true });

      // Execute Claude code with streaming
      for await (const message of query({
        prompt: task.instructions,
        options: {
          cwd,
          maxTurns: agent.options?.maxTurns,
          permissionMode: 'bypassPermissions',
          allowedTools: agent.options?.allowedTools,
          pathToClaudeCodeExecutable: process.env.PATH_TO_CLAUDE_CODE_EXECUTABLE,
          executable: 'bun'
        }
      })) {
        messageCount++;

        // Track if we have an error result
        if (message.type === 'result' && 'is_error' in message && message.is_error) {
          lastError = 'Error detected in execution';
        }

        const messageData =
          JSON.stringify({
            type: message.type,
            content: message,
            messageCount,
            timestamp: new Date().toISOString()
          }) + '\n';
        await stream.write(new TextEncoder().encode(messageData));
      }

      // Update task status to completed
      const completedTaskStatus: Task = {
        taskId: task.id,
        status: lastError ? 'failed' : 'completed',
        startTime: initialTaskStatus.startTime,
        endTime: new Date().toISOString(),
        error: lastError
      };
      await writeTaskStatus(completedTaskStatus);
      await clearMachineStatus();

      // Send completion status
      const completionMessage =
        JSON.stringify({
          type: 'completed',
          message: hasResult
            ? 'Execution completed successfully'
            : 'Execution completed without final result',
          totalMessages: messageCount,
          timestamp: new Date().toISOString()
        }) + '\n';
      await stream.write(new TextEncoder().encode(completionMessage));
    } catch (error) {
      logger.error('Claude code execution error:', error);

      // Update task status to failed
      if (taskStarted) {
        try {
          await writeTaskStatus({
            taskId: task.id,
            status: 'failed',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          });
          await clearMachineStatus();
        } catch (statusError) {
          logger.error('Failed to update task status on error:', statusError);
        }
      }

      const errorMessage =
        JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          timestamp: new Date().toISOString()
        }) + '\n';
      await stream.write(new TextEncoder().encode(errorMessage));
    } finally {
      clearTimeout(timeoutId);
    }
  });
});

taskRouter.get(
  '/task/:taskId/status',
  zValidator('param', z.object({ taskId: z.string().min(1, 'Task ID is required') })),
  async c => {
    const taskId = c.req.valid('param').taskId;

    if (!taskId) {
      return c.json({ error: 'Task ID is required' }, 400);
    }

    try {
      const taskStatus = await readTaskStatus(taskId);

      if (!taskStatus) {
        return c.json({ error: 'Task not found' }, 404);
      }

      return c.json({ taskStatus });
    } catch (error) {
      logger.error(`Failed to get task status for ${taskId}:`, error);
      return c.json({ error: 'Failed to retrieve task status' }, 500);
    }
  }
);

taskRouter.get('/machine/availability', async c => {
  try {
    const availability = await isMachineAvailable();
    return c.json({
      available: availability.available,
      currentTask: availability.currentTask || null
    });
  } catch (error) {
    logger.error('Failed to check machine availability:', error);
    return c.json({ error: 'Failed to check machine availability' }, 500);
  }
});

taskRouter.get('/tasks', async c => {
  try {
    const tasks = await getAllTaskStatuses();
    return c.json({ tasks });
  } catch (error) {
    logger.error('Failed to get all task statuses:', error);
    return c.json({ error: 'Failed to retrieve task statuses' }, 500);
  }
});

taskRouter.post('/machine/clear', async c => {
  try {
    await clearMachineStatus();
    return c.json({ message: 'Machine status cleared successfully' });
  } catch (error) {
    logger.error('Failed to clear machine status:', error);
    return c.json({ error: 'Failed to clear machine status' }, 500);
  }
});
