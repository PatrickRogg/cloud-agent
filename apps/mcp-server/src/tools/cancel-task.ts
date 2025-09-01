import { z } from 'zod/v3';
import { createMcpTool } from '../types/mcp.js';
import { db } from '../utils/db.js';
import { TaskStatus } from '@repo/database/types';

const inputSchema = {
  taskId: z.string().describe('The unique identifier of the task to cancel')
};

const outputSchema = {
  taskId: z.string().describe('The unique identifier of the cancelled task'),
  previousStatus: z.string().describe('The previous status of the task'),
  currentStatus: z.string().describe('The new status of the task'),
  message: z.string().describe('A confirmation message')
};

export const cancelTaskTool = createMcpTool({
  name: 'cancel-task',
  title: 'Cancel Task',
  description: 'Cancels an existing task by setting its status to CANCELLED',
  inputSchema,
  outputSchema,
  callback: async (args) => {
    try {
      // Find the task first
      const existingTask = await db.task.findUnique({
        where: { id: args.taskId }
      });

      if (!existingTask) {
        return {
          content: [
            {
              type: 'text',
              text: `Task with ID "${args.taskId}" not found.`
            }
          ],
          isError: true,
          structuredContent: {
            taskId: args.taskId,
            previousStatus: 'UNKNOWN',
            currentStatus: 'NOT_FOUND',
            message: `Task with ID "${args.taskId}" not found`
          }
        };
      }

      // Check if task can be cancelled
      if (existingTask.status === TaskStatus.COMPLETED) {
        return {
          content: [
            {
              type: 'text',
              text: `Task "${args.taskId}" is already completed and cannot be cancelled.`
            }
          ],
          isError: true,
          structuredContent: {
            taskId: args.taskId,
            previousStatus: TaskStatus.COMPLETED,
            currentStatus: TaskStatus.COMPLETED,
            message: `Task "${args.taskId}" is already completed and cannot be cancelled`
          }
        };
      }

      if (existingTask.status === TaskStatus.CANCELLED) {
        return {
          content: [
            {
              type: 'text',
              text: `Task "${args.taskId}" is already cancelled.`
            }
          ],
          structuredContent: {
            taskId: args.taskId,
            previousStatus: existingTask.status,
            currentStatus: TaskStatus.CANCELLED,
            message: `Task ${args.taskId} was already cancelled`
          }
        };
      }

      const previousStatus = existingTask.status;

      // Update task status in database
      const updatedTask = await db.task.update({
        where: { id: args.taskId },
        data: { status: TaskStatus.CANCELLED }
      });

      return {
        content: [
          {
            type: 'text',
            text: `Task "${args.taskId}" has been successfully cancelled.`
          }
        ],
        structuredContent: {
          taskId: updatedTask.id,
          previousStatus,
          currentStatus: updatedTask.status,
          message: `Task ${updatedTask.id} successfully cancelled`
        }
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to cancel task: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ],
        isError: true,
        structuredContent: {
          taskId: args.taskId,
          previousStatus: 'UNKNOWN',
          currentStatus: 'ERROR',
          message: `Failed to cancel task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }
});
