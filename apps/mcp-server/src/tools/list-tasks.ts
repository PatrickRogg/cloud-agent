import { z } from 'zod/v3';
import { createMcpTool } from '../types/mcp.js';
import { db } from '../utils/db.js';
import { TaskStatus } from '@repo/database/types';

const inputSchema = {
  limit: z.number().optional().describe('Maximum number of tasks to return (default: 50)'),
  status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional().describe('Filter tasks by status'),
  offset: z.number().optional().describe('Number of tasks to skip for pagination (default: 0)')
};

const outputSchema = {
  tasks: z.array(z.object({
    id: z.string(),
    instructions: z.string(),
    status: z.string(),
    virtualMachineId: z.string().optional(),
    createdOn: z.string(),
    updatedOn: z.string()
  })).describe('Array of tasks matching the filter criteria'),
  total: z.number().describe('Total number of tasks matching the filter criteria'),
  limit: z.number().describe('The limit applied to the results'),
  offset: z.number().describe('The offset applied to the results')
};

export const listTasksTool = createMcpTool({
  name: 'list-tasks',
  title: 'List Tasks',
  description: 'Retrieves a list of tasks with optional filtering by status, limit, and pagination',
  inputSchema,
  outputSchema,
  callback: async (args) => {
    try {
      const limit = args.limit || 50;
      const offset = args.offset || 0;
      
      // Build where clause for filtering
      const whereClause: any = {};
      if (args.status) {
        whereClause.status = args.status as TaskStatus;
      }

      // Get total count for pagination info
      const total = await db.task.count({
        where: whereClause
      });

      // Get tasks with filtering and pagination
      const tasks = await db.task.findMany({
        where: whereClause,
        orderBy: { createdOn: 'desc' },
        take: limit,
        skip: offset
      });

      const taskList = tasks.map(task => ({
        id: task.id,
        instructions: task.instructions,
        status: task.status,
        virtualMachineId: task.virtualMachineId || undefined,
        createdOn: task.createdOn.toISOString(),
        updatedOn: task.updatedOn.toISOString()
      }));

      const statusFilter = args.status ? ` with status ${args.status}` : '';
      const resultText = `Found ${taskList.length} task(s)${statusFilter} (showing ${offset + 1}-${offset + taskList.length} of ${total} total)`;

      return {
        content: [
          {
            type: 'text',
            text: resultText
          },
          {
            type: 'text',
            text: taskList.length > 0 
              ? `Tasks:\n${taskList.map(task => `- ${task.id}: ${task.instructions} (${task.status})`).join('\n')}`
              : 'No tasks found matching the criteria.'
          }
        ],
        structuredContent: {
          tasks: taskList,
          total,
          limit,
          offset
        }
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ],
        isError: true,
        structuredContent: {
          tasks: [],
          total: 0,
          limit: 0,
          offset: 0
        }
      };
    }
  }
});
