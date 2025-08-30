import { CloudProvider, VmStatus } from '@repo/common/types/vm';

export interface CreateVmParams {
  name: string;
  provider: CloudProvider;
  region: string;
  instanceType: string;
  tags?: Record<string, string>;
}

export interface VmFilters {
  status?: VmStatus;
  provider?: CloudProvider;
  region?: string;
}

export interface UpdateVmParams {
  name?: string;
  status?: VmStatus;
  ip?: string;
  tags?: Record<string, string>;
}

export interface AgentExecutionParams {
  vmId: string;
  prompt: string;
  tools?: string[];
  timeout?: number;
  sessionId?: string;
}

export interface AgentExecution {
  id: string;
  vmId: string;
  prompt: string;
  tools?: string[];
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout';
  result?: {
    output: string;
    toolCalls: Array<{ tool: string; input: any; output: any }>;
    tokensUsed: number;
    duration: number;
  };
  metadata: {
    startedAt?: Date;
    completedAt?: Date;
    timeout: number;
    retryCount: number;
    sessionId?: string;
  };
}

export interface GlobalConfig {
  defaultProvider: CloudProvider;
  defaultInstanceType: string;
  defaultRegion: string;
  maxConcurrentAgents: number;
  agentTimeout: number;
  vmSelection: {
    defaultBehavior: 'ask' | 'new' | 'existing';
    preferredVM?: string;
  };
}
