import z from 'zod';

export type VmStatus = 'creating' | 'running' | 'stopped' | 'error' | 'deleted';
export type VmApiStatus = 'healthy' | 'unhealthy' | 'no-ip-assigned' | 'unknown';
export const cloudProviderEnum = z.enum(['hetzner']);
export type CloudProvider = z.infer<typeof cloudProviderEnum>;

export interface VirtualMachine {
  id: string;
  name: string;
  provider: CloudProvider;
  status: VmStatus;
  apiStatus: VmApiStatus;
  ip?: string;
  region: string;
  instanceType: string;
  createdAt: Date;
  tags: Record<string, string>;
  // Provider-specific metadata
  providerData?: {
    hetzner?: {
      serverId: number;
      serverType: string;
      datacenter: string;
      image: string;
    };
  };
}
