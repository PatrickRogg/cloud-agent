import z from 'zod';

export type VmStatus = 'creating' | 'running' | 'stopped' | 'error' | 'deleted';
export const cloudProviderEnum = z.enum(['hetzner']);
export type CloudProvider = z.infer<typeof cloudProviderEnum>;

export interface VirtualMachine {
  id: string;
  name: string;
  provider: CloudProvider;
  status: VmStatus;
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
