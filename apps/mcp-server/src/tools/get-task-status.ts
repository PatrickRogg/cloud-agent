import { z } from 'zod/v3';
import { createMcpTool } from '../types/mcp.js';
import { db } from '../utils/db.js';

const inputSchema = {
  taskId: z.string().describe('The unique identifier of the task to get status for')
};

const outputSchema = {
  taskId: z.string().describe('The unique identifier of the task'),
  instructions: z.string().describe('The task instructions'),
  status: z.string().describe('The current status of the task'),
  virtualMachineId: z.string().optional().describe('The ID of the virtual machine running the task'),
  createdOn: z.string().describe('When the task was created'),
  updatedOn: z.string().describe('When the task was last updated')
};

export const getTaskStatusTool = createMcpTool({
  name: 'get-task-status',
  title: 'Get Task Status',
  description: 'Retrieves the current status and details of a specific task',
  inputSchema,
  outputSchema,
  callback: async args => {
    try {
      const task = await db.task.findUnique({
        where: { id: args.taskId }
      });

      if (!task) {
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
            instructions: '',
            status: '',
            virtualMachineId: undefined,
            createdOn: '',
            updatedOn: ''
          }
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Task "${task.id}": ${task.instructions}\nStatus: ${task.status}\nVM: ${task.virtualMachineId || 'Not assigned'}\nCreated: ${task.createdOn.toISOString()}\nUpdated: ${task.updatedOn.toISOString()}`
          }
        ],
        structuredContent: {
          taskId: task.id,
          instructions: task.instructions,
          status: task.status,
          virtualMachineId: task.virtualMachineId ?? undefined,
          createdOn: task.createdOn.toISOString(),
          updatedOn: task.updatedOn.toISOString()
        }
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get task status: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ],
        isError: true,
        structuredContent: {
          taskId: args.taskId,
          instructions: '',
          status: '',
          virtualMachineId: undefined,
          createdOn: '',
          updatedOn: ''
        }
      };
    }
  }
});
