import { Agent } from '@repo/common/types/agent';
import { Task, TaskPriority, TaskStatus } from '@repo/common/types/task';
import { VirtualMachine } from '@repo/common/types/vm';

export interface TaskQueueOptions {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  agentId?: string;
  vmId?: string;
  limit?: number;
  offset?: number;
}

export interface BaseStorage {
  vm: {
    findMany(): Promise<VirtualMachine[]>;
    findById(id: string): Promise<VirtualMachine | null>;
    create(data: Omit<VirtualMachine, 'id'> & { id?: string }): Promise<VirtualMachine>;
    update(id: string, data: Partial<VirtualMachine>): Promise<VirtualMachine>;
    delete(id: string): Promise<void>;
    findAvailable(): Promise<VirtualMachine[]>; // Find VMs that are running and not busy
  };
  agent: {
    findMany(): Promise<Agent[]>;
    findById(id: string): Promise<Agent | null>;
    findByName(name: string): Promise<Agent | null>;
    create(data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<Agent>;
    update(id: string, data: Partial<Omit<Agent, 'id' | 'createdAt'>>): Promise<Agent>;
    delete(id: string): Promise<void>;
  };
  task: {
    findMany(options?: TaskQueueOptions): Promise<Task[]>;
    findById(id: string): Promise<Task | null>;
    create(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'retryCount'>): Promise<Task>;
    update(id: string, data: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task>;
    delete(id: string): Promise<void>;
    getNextInQueue(): Promise<Task | null>; // Get next task to process
    getQueuedCount(): Promise<number>; // Count of queued tasks
    getRunningCount(): Promise<number>; // Count of running tasks
    markAsRunning(id: string, vmId: string): Promise<Task>; // Mark task as running on specific VM
    markAsCompleted(id: string, result: string): Promise<Task>; // Mark task as completed with result
    markAsFailed(id: string, error: string): Promise<Task>; // Mark task as failed with error
  };
  initialize(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Storage configuration interface
 */
export interface StorageConfig {
  type: 'json' | 'sqlite' | 'postgres' | 'cloud';
  path?: string; // for json/sqlite
  connection?: string; // for postgres
  apiUrl?: string; // for cloud
  apiKey?: string; // for cloud
}

/**
 * Storage factory interface
 */
export interface StorageFactory {
  create(config: StorageConfig): BaseStorage;
}
