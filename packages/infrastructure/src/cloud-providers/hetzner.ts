import { logger } from '@repo/common/logger';
import { VirtualMachine, VmStatus } from '@repo/common/types/vm';
import axios, { AxiosInstance } from 'axios';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';
import { HETZNER } from '../types/constants';
import { VmError } from '../types/error';
import {
  HetznerCreateServerRequest,
  HetznerCreateServerResponse,
  HetznerCreateSshKeyRequest,
  HetznerCreateSshKeyResponse,
  HetznerListServersResponse,
  HetznerListSshKeysResponse,
  HetznerServer,
  HetznerSshKey
} from '../types/hetzner';
import { BaseCloudProvider, CreateVmRequest } from './base-provider';
import { Config } from '@repo/common/types/config';

export interface HetznerConfig {
  token: string;
}

export class HetznerProvider extends BaseCloudProvider {
  private client: AxiosInstance;
  config: HetznerConfig;

  constructor(config: HetznerConfig) {
    super(config);
    this.config = config;
    this.client = axios.create({
      baseURL: HETZNER.API_BASE_URL,
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  async createVm(request: CreateVmRequest, config: Config): Promise<VirtualMachine> {
    try {
      const userData = this.generateUserData({
        vmApiKey: config.vm.apiKey,
        auth: config.auth
      });

      // Get or create SSH key
      const publicKey = this.readPublicKeyFromPath(config.vm.sshKey);
      const sshKeyId = await this.createSshKeyIfNotExists({ publicKey });

      const createRequest: HetznerCreateServerRequest = {
        name: request.name,
        server_type: request.instanceType,
        image: HETZNER.DEFAULT_IMAGE,
        location: request.region,
        start_after_create: true,
        ssh_keys: [sshKeyId.toString()],
        user_data: userData,
        labels: {
          cloudAgent: 'true',
          cloudAgentName: request.name,
          ...request.tags
        },
        public_net: {
          enable_ipv4: true,
          enable_ipv6: false
        }
      };

      const response = await this.client.post<HetznerCreateServerResponse>(
        '/servers',
        createRequest
      );
      const server = response.data.server;

      return await this.mapHetznerServerToVm(server);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(error.response?.data);
        const message = error.response?.data?.error?.message || error.message;
        throw new VmError(`Failed to create Hetzner Vm: ${message}`, 'Vm_CREATION_FAILED');
      }
      throw error;
    }
  }

  async getVm(id: string): Promise<VirtualMachine | null> {
    try {
      const response = await this.client.get<{ server: HetznerServer }>(`/servers/${id}`);
      return await this.mapHetznerServerToVm(response.data.server);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw new VmError(
        `Failed to get Hetzner Vm: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Vm_NOT_FOUND',
        id
      );
    }
  }

  async listVms(): Promise<VirtualMachine[]> {
    try {
      const response = await this.client.get<HetznerListServersResponse>('/servers', {
        params: {
          label_selector: 'cloudAgent=true'
        }
      });

      return await Promise.all(
        response.data.servers.map(server => this.mapHetznerServerToVm(server))
      );
    } catch (error) {
      throw new VmError(
        `Failed to list Hetzner Vms: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROVIDER_AUTH_ERROR'
      );
    }
  }

  async deleteVm(id: string): Promise<void> {
    try {
      await this.client.delete(`/servers/${id}`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Vm already deleted
        return;
      }
      throw new VmError(
        `Failed to delete Hetzner Vm: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Vm_DELETION_FAILED',
        id
      );
    }
  }

  async startVm(id: string): Promise<void> {
    try {
      await this.client.post(`/servers/${id}/actions/poweron`);
    } catch (error) {
      throw new VmError(
        `Failed to start Hetzner Vm: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Vm_CREATION_FAILED',
        id
      );
    }
  }

  async stopVm(id: string): Promise<void> {
    try {
      await this.client.post(`/servers/${id}/actions/shutdown`);
    } catch (error) {
      throw new VmError(
        `Failed to stop Hetzner Vm: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Vm_CREATION_FAILED',
        id
      );
    }
  }

  async getVmStatus(id: string): Promise<string> {
    const vm = await this.getVm(id);
    return vm?.status || 'unknown';
  }

  async getAvailableRegions(): Promise<string[]> {
    try {
      const response = await this.client.get('/locations');
      return response.data.locations.map((location: any) => location.name);
    } catch (error) {
      throw new VmError(
        `Failed to get Hetzner regions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROVIDER_AUTH_ERROR'
      );
    }
  }

  async getAvailableInstanceTypes(): Promise<string[]> {
    try {
      const response = await this.client.get('/server_types');
      return response.data.server_types.map((type: any) => type.name);
    } catch (error) {
      throw new VmError(
        `Failed to get Hetzner instance types: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROVIDER_AUTH_ERROR'
      );
    }
  }

  private readPublicKeyFromPath(sshKeyPath: string): string {
    try {
      // Expand tilde to home directory
      let expandedPath = sshKeyPath.startsWith('~')
        ? sshKeyPath.replace('~', homedir())
        : sshKeyPath;

      // If the path doesn't end with .pub, assume it's a private key and append .pub
      if (!expandedPath.endsWith('.pub')) {
        expandedPath = `${expandedPath}.pub`;
      }

      // Resolve to absolute path
      const absolutePath = resolve(expandedPath);

      // Read the public key file
      const publicKey = readFileSync(absolutePath, 'utf8').trim();

      if (!publicKey) {
        throw new Error(`SSH public key file is empty: ${absolutePath}`);
      }

      return publicKey;
    } catch (error) {
      throw new VmError(
        `Failed to read SSH public key from ${sshKeyPath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SSH_KEY_READ_FAILED'
      );
    }
  }

  async listSshKeys(name?: string): Promise<HetznerSshKey[]> {
    try {
      const params: any = {};
      if (name) {
        params.name = name;
      }

      const response = await this.client.get<HetznerListSshKeysResponse>('/ssh_keys', {
        params
      });

      return response.data.ssh_keys;
    } catch (error) {
      throw new VmError(
        `Failed to list Hetzner SSH keys: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROVIDER_AUTH_ERROR'
      );
    }
  }

  async createSshKey(
    name: string,
    publicKey: string,
    labels?: Record<string, string>
  ): Promise<HetznerSshKey> {
    try {
      const createRequest: HetznerCreateSshKeyRequest = {
        name,
        public_key: publicKey,
        labels
      };

      const response = await this.client.post<HetznerCreateSshKeyResponse>(
        '/ssh_keys',
        createRequest
      );

      logger.info(`Created SSH key: ${JSON.stringify(response.data.ssh_key.name)}`);

      return response.data.ssh_key;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(error.response?.data);
        const message = error.response?.data?.error?.message || error.message;
        throw new VmError(
          `Failed to create Hetzner SSH key: ${message}`,
          'SSH_KEY_CREATION_FAILED'
        );
      }
      throw error;
    }
  }

  async createSshKeyIfNotExists({ publicKey }: { publicKey: string }): Promise<number> {
    try {
      const sshKeyName = `cloud-agent`;
      const existingSshKeys = await this.listSshKeys(sshKeyName);

      if (existingSshKeys.length > 0) {
        logger.info(`SSH key ${sshKeyName} already exists, using existing key`);
        return existingSshKeys[0]!.id;
      }

      // Create new SSH key
      logger.info(`Creating new SSH key: ${sshKeyName}`);
      const newSshKey = await this.createSshKey(sshKeyName, publicKey, {
        cloudAgent: 'true',
        createdBy: 'cloudAgent'
      });

      return newSshKey.id;
    } catch (error) {
      throw new VmError(
        `Failed to ensure SSH key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SSH_KEY_MANAGEMENT_FAILED'
      );
    }
  }

  private async mapHetznerServerToVm(server: HetznerServer): Promise<VirtualMachine> {
    const apiStatus = await this.checkVmApiStatus(server.public_net.ipv4?.ip);

    return {
      id: server.id.toString(),
      name: server.name,
      status: this.mapHetznerStatus(server.status),
      apiStatus,
      provider: 'hetzner',
      ip: server.public_net.ipv4?.ip,
      region: server.datacenter.location.name,
      instanceType: server.server_type.name,
      createdAt: new Date(server.created),
      providerData: {
        hetzner: {
          serverId: server.id,
          serverType: server.server_type.name,
          datacenter: server.datacenter.name,
          image: server.image.name
        }
      },
      tags: {}
    };
  }

  private mapHetznerStatus(status: string): VmStatus {
    const statusMap: Record<string, VmStatus> = {
      initializing: 'creating',
      starting: 'creating',
      running: 'running',
      stopping: 'stopped',
      off: 'stopped',
      deleting: 'deleted',
      migrating: 'running',
      rebuilding: 'creating',
      unknown: 'error'
    };

    return statusMap[status] || 'error';
  }
}
