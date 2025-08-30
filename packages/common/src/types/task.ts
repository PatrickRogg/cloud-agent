export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type Task = {
  id: string;
  agentId: string;
  vmId?: string;
  prompt: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
};
