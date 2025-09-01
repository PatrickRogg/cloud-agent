import { CLOUD_AGENT } from '@repo/common/constants';
import { AuthConfig } from '@repo/common/types/config';
import { VirtualMachine, VmApiStatus } from '@repo/common/types/vm';
import axios from 'axios';

export interface CloudProviderConfig {
  [key: string]: any;
}

export interface CreateVmRequest {
  name: string;
  region: string;
  instanceType: string;
  sshKey: string;
  vmApiKey: string;
  userData?: string;
  tags?: Record<string, string>;
}

export abstract class BaseCloudProvider {
  protected config: CloudProviderConfig;

  constructor(config: CloudProviderConfig) {
    this.config = config;
  }

  /**
   * Create a new Vm instance
   */
  abstract createVm(request: CreateVmRequest): Promise<VirtualMachine>;

  /**
   * Get Vm details by provider ID
   */
  abstract getVm(id: string): Promise<VirtualMachine | null>;

  /**
   * List all Vms
   */
  abstract listVms(): Promise<VirtualMachine[]>;

  /**
   * Delete a Vm by provider ID
   */
  abstract deleteVm(id: string): Promise<void>;

  /**
   * Start a Vm by provider ID
   */
  abstract startVm(id: string): Promise<void>;

  /**
   * Stop a Vm by provider ID
   */
  abstract stopVm(id: string): Promise<void>;

  /**
   * Get Vm status by provider ID
   */
  abstract getVmStatus(id: string): Promise<string>;

  /**
   * Get available regions for this provider
   */
  abstract getAvailableRegions(): Promise<string[]>;

  /**
   * Get available instance types for this provider
   */
  abstract getAvailableInstanceTypes(): Promise<string[]>;

  /**
   * Check Vm API status
   */
  protected async checkVmApiStatus(ip: string | undefined): Promise<VmApiStatus> {
    if (!ip) {
      return 'no-ip-assigned';
    }

    try {
      const response = await axios.get(`http://${ip}:${CLOUD_AGENT.VM_API_PORT}/health`, {
        timeout: 5000
      });
      return response.status === 200 ? 'healthy' : 'unhealthy';
    } catch (error) {
      return 'unhealthy';
    }
  }

  /**
   * Generate cloud-init user data for Vm setup
   */
  protected generateUserData({ vmApiKey, auth }: { vmApiKey: string; auth: AuthConfig }): string {
    return `#cloud-config
packages:
  - nodejs
  - npm
  - git
  - curl
  - fail2ban
  - ufw

runcmd:
  # Configure firewall
  - ufw --force enable
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow ssh
  - ufw allow ${CLOUD_AGENT.VM_API_PORT}/tcp
  
  # Configure fail2ban
  - systemctl enable fail2ban
  - systemctl start fail2ban

  # Install js dependencies
  - npm install -g pnpm@10.12.4
  - npm install -g bun
  
  # Clone and setup Vm API server
  - cd /opt
  - git clone https://github.com/PatrickRogg/cloud-agent.git
  - cd /opt/cloud-agent && pnpm --filter @repo/vm-api-server --filter @repo/common install --frozen-lockfile
  
  # Install PM2 globally
  - npm install -g pm2

  # Create ecosystem.config.js file
  - |
    cat > /opt/cloud-agent/ecosystem.config.js << 'EOF'
    module.exports = {
      apps: [{
        name: "vm-api-server",
        script: "pnpm --filter @repo/vm-api-server start",
        env: {
          NODE_ENV: "production",
          API_KEY: "${vmApiKey}",
          PORT: "${CLOUD_AGENT.VM_API_PORT}",
          ${auth.anthropic.oAuthToken ? `CLAUDE_CODE_OAUTH_TOKEN: "${auth.anthropic.oAuthToken}"` : `CLAUDE_CODE_API_KEY: "${auth.anthropic.apiKey}"`}
          ${auth.anthropic.apiKey ? `ANTHROPIC_API_KEY: "${auth.anthropic.apiKey}"` : ''}
        }
      }]
    }
    EOF

  # Start the Vm API server
  - pm2 start ecosystem.config.js
  - pm2 startup
  - pm2 save
  
  # Set up log rotation
  - pm2 install pm2-logrotate

final_message: "Vm setup complete. Agent API server is running on port ${CLOUD_AGENT.VM_API_PORT}."
`;
  }
}
