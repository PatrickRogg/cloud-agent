import * as fs from 'fs-extra';
import * as path from 'path';
import { BaseStorage, TaskQueueOptions } from '../interfaces/base-storage';
import { StorageError } from '../types/errors';
import { VirtualMachine } from '@repo/common/types/vm';
import { Agent } from '@repo/common/types/agent';
import { Task, TaskStatus } from '@repo/common/types/task';
import { v4 as uuid } from 'uuid';

export class JsonFileStorage implements BaseStorage {
  private filePath: string;
  private data: { vms: VirtualMachine[]; agents: Agent[]; tasks: Task[] } = { vms: [], agents: [], tasks: [] };
  private initialized = false;

  constructor({ filePath }: { filePath: string }) {
    // Expand ~ to home directory
    this.filePath = filePath.startsWith('~')
      ? path.join(process.env.HOME || process.env.USERPROFILE || '', filePath.slice(2))
      : filePath;
  }

  // VM operations
  public vm = {
    findMany: async (): Promise<VirtualMachine[]> => {
      await this.ensureInitialized();
      return [...this.data.vms];
    },

    findById: async (id: string): Promise<VirtualMachine | null> => {
      await this.ensureInitialized();
      return this.data.vms.find(vm => vm.id === id) || null;
    },

    create: async (data: Omit<VirtualMachine, 'id'> & { id?: string }): Promise<VirtualMachine> => {
      await this.ensureInitialized();

      const newVm: VirtualMachine = {
        ...data,
        id: data.id || uuid()
      };

      // Check for name uniqueness
      const existing = this.data.vms.find(vm => vm.name === newVm.name);
      if (existing) {
        throw new StorageError(
          `VM with name '${newVm.name}' already exists`,
          'STORAGE_WRITE_ERROR'
        );
      }

      this.data.vms.push(newVm);
      await this.saveData();
      return newVm;
    },

    update: async (id: string, data: Partial<VirtualMachine>): Promise<VirtualMachine> => {
      await this.ensureInitialized();

      const index = this.data.vms.findIndex(vm => vm.id === id);
      if (index === -1) {
        throw new StorageError(`VM with ID '${id}' not found`, 'STORAGE_WRITE_ERROR');
      }

      // Check for name uniqueness if name is being updated
      if (data.name) {
        const existing = this.data.vms.find(vm => vm.name === data.name && vm.id !== id);
        if (existing) {
          throw new StorageError(
            `VM with name '${data.name}' already exists`,
            'STORAGE_WRITE_ERROR'
          );
        }
      }

      const existingVm = this.data.vms[index]!; // Safe because we already checked index exists
      const updatedVm: VirtualMachine = {
        ...existingVm,
        ...data,
        id // Ensure ID cannot be changed
      };

      this.data.vms[index] = updatedVm;
      await this.saveData();
      return updatedVm;
    },

    delete: async (id: string): Promise<void> => {
      await this.ensureInitialized();

      const index = this.data.vms.findIndex(vm => vm.id === id);
      if (index === -1) {
        throw new StorageError(`VM with ID '${id}' not found`, 'STORAGE_WRITE_ERROR');
      }

      this.data.vms.splice(index, 1);
      await this.saveData();
    },

    findAvailable: async (): Promise<VirtualMachine[]> => {
      await this.ensureInitialized();
      const runningTasks = this.data.tasks.filter(task => task.status === 'running');
      const busyVmIds = new Set(runningTasks.map(task => task.vmId).filter(Boolean));

      return this.data.vms.filter(vm => vm.status === 'running' && !busyVmIds.has(vm.id));
    }
  };

  // Agent operations
  public agent = {
    findMany: async (): Promise<Agent[]> => {
      await this.ensureInitialized();
      return [...this.data.agents];
    },

    findById: async (id: string): Promise<Agent | null> => {
      await this.ensureInitialized();
      return this.data.agents.find(agent => agent.id === id) || null;
    },

    findByName: async (name: string): Promise<Agent | null> => {
      await this.ensureInitialized();
      return this.data.agents.find(agent => agent.name === name) || null;
    },

    create: async (data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<Agent> => {
      await this.ensureInitialized();

      // Check for name uniqueness
      const existing = this.data.agents.find(agent => agent.name === data.name);
      if (existing) {
        throw new StorageError(
          `Agent with name '${data.name}' already exists`,
          'STORAGE_WRITE_ERROR'
        );
      }

      const now = new Date();
      const newAgent: Agent = {
        ...data,
        id: uuid(),
        createdAt: now,
        updatedAt: now
      };

      this.data.agents.push(newAgent);
      await this.saveData();
      return newAgent;
    },

    update: async (id: string, data: Partial<Omit<Agent, 'id' | 'createdAt'>>): Promise<Agent> => {
      await this.ensureInitialized();

      const index = this.data.agents.findIndex(agent => agent.id === id);
      if (index === -1) {
        throw new StorageError(`Agent with ID '${id}' not found`, 'STORAGE_WRITE_ERROR');
      }

      // Check for name uniqueness if name is being updated
      if (data.name) {
        const existing = this.data.agents.find(
          agent => agent.name === data.name && agent.id !== id
        );
        if (existing) {
          throw new StorageError(
            `Agent with name '${data.name}' already exists`,
            'STORAGE_WRITE_ERROR'
          );
        }
      }

      const existingAgent = this.data.agents[index]!;
      const updatedAgent: Agent = {
        ...existingAgent,
        ...data,
        id, // Ensure ID cannot be changed
        createdAt: existingAgent.createdAt, // Ensure createdAt cannot be changed
        updatedAt: new Date()
      };

      this.data.agents[index] = updatedAgent;
      await this.saveData();
      return updatedAgent;
    },

    delete: async (id: string): Promise<void> => {
      await this.ensureInitialized();

      const index = this.data.agents.findIndex(agent => agent.id === id);
      if (index === -1) {
        throw new StorageError(`Agent with ID '${id}' not found`, 'STORAGE_WRITE_ERROR');
      }

      this.data.agents.splice(index, 1);
      await this.saveData();
    }
  };

  // Task operations
  public task = {
    findMany: async (options?: TaskQueueOptions): Promise<Task[]> => {
      await this.ensureInitialized();
      let tasks = [...this.data.tasks];

      // Apply filters
      if (options?.status && options.status.length > 0) {
        tasks = tasks.filter(task => options.status!.includes(task.status));
      }
      if (options?.priority && options.priority.length > 0) {
        tasks = tasks.filter(task => options.priority!.includes(task.priority));
      }
      if (options?.agentId) {
        tasks = tasks.filter(task => task.agentId === options.agentId);
      }
      if (options?.vmId) {
        tasks = tasks.filter(task => task.vmId === options.vmId);
      }

      // Sort by priority (urgent > high > normal > low) and then by createdAt
      const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
      tasks.sort((a, b) => {
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      // Apply pagination
      if (options?.offset) {
        tasks = tasks.slice(options.offset);
      }
      if (options?.limit) {
        tasks = tasks.slice(0, options.limit);
      }

      return tasks;
    },

    findById: async (id: string): Promise<Task | null> => {
      await this.ensureInitialized();
      return this.data.tasks.find(task => task.id === id) || null;
    },

    create: async (
      data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'retryCount'>
    ): Promise<Task> => {
      await this.ensureInitialized();

      const now = new Date();
      const newTask: Task = {
        ...data,
        id: uuid(),
        createdAt: now,
        updatedAt: now,
        retryCount: 0
      };

      this.data.tasks.push(newTask);
      await this.saveData();
      return newTask;
    },

    update: async (id: string, data: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task> => {
      await this.ensureInitialized();

      const index = this.data.tasks.findIndex(task => task.id === id);
      if (index === -1) {
        throw new StorageError(`Task with ID '${id}' not found`, 'STORAGE_WRITE_ERROR');
      }

      const existingTask = this.data.tasks[index]!;
      const updatedTask: Task = {
        ...existingTask,
        ...data,
        id, // Ensure ID cannot be changed
        createdAt: existingTask.createdAt, // Ensure createdAt cannot be changed
        updatedAt: new Date()
      };

      this.data.tasks[index] = updatedTask;
      await this.saveData();
      return updatedTask;
    },

    delete: async (id: string): Promise<void> => {
      await this.ensureInitialized();

      const index = this.data.tasks.findIndex(task => task.id === id);
      if (index === -1) {
        throw new StorageError(`Task with ID '${id}' not found`, 'STORAGE_WRITE_ERROR');
      }

      this.data.tasks.splice(index, 1);
      await this.saveData();
    },

    getNextInQueue: async (): Promise<Task | null> => {
      await this.ensureInitialized();
      const queuedTasks = this.data.tasks.filter(task => task.status === 'queued');

      if (queuedTasks.length === 0) return null;

      // Sort by priority and then by createdAt
      const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
      queuedTasks.sort((a, b) => {
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      return queuedTasks[0] || null;
    },

    getQueuedCount: async (): Promise<number> => {
      await this.ensureInitialized();
      return this.data.tasks.filter(task => task.status === 'queued').length;
    },

    getRunningCount: async (): Promise<number> => {
      await this.ensureInitialized();
      return this.data.tasks.filter(task => task.status === 'running').length;
    },

    markAsRunning: async (id: string, vmId: string): Promise<Task> => {
      await this.ensureInitialized();

      const index = this.data.tasks.findIndex(task => task.id === id);
      if (index === -1) {
        throw new StorageError(`Task with ID '${id}' not found`, 'STORAGE_WRITE_ERROR');
      }

      const task = this.data.tasks[index]!;
      if (task.status !== 'queued') {
        throw new StorageError(
          `Task with ID '${id}' is not in queued status`,
          'STORAGE_WRITE_ERROR'
        );
      }

      const updatedTask: Task = {
        ...task,
        status: 'running',
        vmId,
        startedAt: new Date(),
        updatedAt: new Date()
      };

      this.data.tasks[index] = updatedTask;
      await this.saveData();
      return updatedTask;
    },

    markAsCompleted: async (id: string, result: string): Promise<Task> => {
      await this.ensureInitialized();

      const index = this.data.tasks.findIndex(task => task.id === id);
      if (index === -1) {
        throw new StorageError(`Task with ID '${id}' not found`, 'STORAGE_WRITE_ERROR');
      }

      const task = this.data.tasks[index]!;
      const updatedTask: Task = {
        ...task,
        status: 'completed',
        result,
        completedAt: new Date(),
        updatedAt: new Date()
      };

      this.data.tasks[index] = updatedTask;
      await this.saveData();
      return updatedTask;
    },

    markAsFailed: async (id: string, error: string): Promise<Task> => {
      await this.ensureInitialized();

      const index = this.data.tasks.findIndex(task => task.id === id);
      if (index === -1) {
        throw new StorageError(`Task with ID '${id}' not found`, 'STORAGE_WRITE_ERROR');
      }

      const task = this.data.tasks[index]!;
      const updatedTask: Task = {
        ...task,
        status: 'failed',
        error,
        completedAt: new Date(),
        updatedAt: new Date(),
        retryCount: task.retryCount + 1
      };

      this.data.tasks[index] = updatedTask;
      await this.saveData();
      return updatedTask;
    }
  };

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure directory exists
      await fs.ensureDir(path.dirname(this.filePath));

      // Load existing data if file exists
      if (await fs.pathExists(this.filePath)) {
        const fileContent = await fs.readFile(this.filePath, 'utf-8');
        try {
          const parsedData = JSON.parse(fileContent);
          // Ensure the data has the expected structure
          this.data = {
            vms: parsedData.vms || [],
            agents: parsedData.agents || [],
            tasks: parsedData.tasks || []
          };
        } catch (parseError) {
          throw new StorageError(
            `Failed to parse JSON file: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            'STORAGE_READ_ERROR'
          );
        }
      } else {
        // Create empty file with proper structure
        await this.saveData();
      }

      this.initialized = true;
    } catch (error) {
      throw new StorageError(
        `Failed to initialize JSON storage: ${error instanceof Error ? error.message : String(error)}`,
        'STORAGE_CONNECTION_ERROR'
      );
    }
  }

  async close(): Promise<void> {
    // JSON file storage doesn't need explicit closing
    this.initialized = false;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async saveData(): Promise<void> {
    try {
      // Atomic write: write to temp file first, then rename
      const tempPath = `${this.filePath}.tmp`;
      const jsonData = JSON.stringify(this.data, null, 2);

      await fs.writeFile(tempPath, jsonData, 'utf-8');
      await fs.move(tempPath, this.filePath);
    } catch (error) {
      throw new StorageError(
        `Failed to save data: ${error instanceof Error ? error.message : String(error)}`,
        'STORAGE_WRITE_ERROR'
      );
    }
  }
}
