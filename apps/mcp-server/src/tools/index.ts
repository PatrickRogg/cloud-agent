import { McpTool } from '../types/mcp';
import { startTaskTool } from './start-task.js';
import { cancelTaskTool } from './cancel-task.js';
import { listTasksTool } from './list-tasks.js';
import { getTaskStatusTool } from './get-task-status.js';

export const tools: McpTool<any, any>[] = [
  startTaskTool,
  cancelTaskTool,
  listTasksTool,
  getTaskStatusTool
];
