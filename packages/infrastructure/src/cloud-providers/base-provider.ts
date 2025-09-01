import { CLOUD_AGENT } from '@repo/common/constants';
import { AuthConfig, Config } from '@repo/common/types/config';
import { VirtualMachine, VmApiStatus } from '@repo/common/types/vm';
import axios from 'axios';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

export interface CloudProviderConfig {
  [key: string]: any;
}

export interface CreateVmRequest {
  name: string;
  region: string;
  instanceType: string;
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
  abstract createVm(request: CreateVmRequest, config: Config): Promise<VirtualMachine>;

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
   * Read Claude credential files from local .claude directory
   */
  protected readClaudeCredentialFiles(claudeDirectory: string): {
    settingsBase64?: string;
    credentialsBase64?: string;
  } {
    try {
      // Expand tilde to home directory
      const expandedPath = claudeDirectory.startsWith('~')
        ? claudeDirectory.replace('~', homedir())
        : claudeDirectory;

      // Resolve to absolute path
      const absolutePath = resolve(expandedPath);

      const result: { settingsBase64?: string; credentialsBase64?: string } = {};

      // Read settings.json if it exists and base64 encode it
      const settingsPath = resolve(absolutePath, 'settings.json');
      if (existsSync(settingsPath)) {
        const settingsContent = readFileSync(settingsPath, 'utf8');
        result.settingsBase64 = Buffer.from(settingsContent).toString('base64');
      }

      // Read .credentials.json if it exists and base64 encode it
      const credentialsPath = resolve(absolutePath, '.credentials.json');
      if (existsSync(credentialsPath)) {
        const credentialsContent = readFileSync(credentialsPath, 'utf8');
        result.credentialsBase64 = Buffer.from(credentialsContent).toString('base64');
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to read Claude credential files from ${claudeDirectory}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate cloud-init user data for Vm setup
   */
  protected generateUserData({ vmApiKey, auth }: { vmApiKey: string; auth: AuthConfig }): string {
    // Read Claude credential files if claudeDirectory is configured
    let claudeFiles: { settingsBase64?: string; credentialsBase64?: string } = {};
    if (auth.anthropic.claudeDirectory) {
      claudeFiles = this.readClaudeCredentialFiles(auth.anthropic.claudeDirectory);
    }

    return `#cloud-config
users:
  - name: agent
    shell: /bin/bash
    sudo: ['ALL=(ALL) NOPASSWD:ALL']
    home: /home/agent
    create_home: true

packages:
  - git
  - curl
  - ufw

runcmd:
  # Update package list and install dependencies in proper order
  - apt-get update
  - apt-get install -y fail2ban

  # Install Node.js using NodeSource repository (proper system-wide installation)
  - curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  - apt-get install -y nodejs

  # Configure firewall
  - ufw --force enable
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow ssh
  - ufw allow ${CLOUD_AGENT.VM_API_PORT}/tcp

  # Configure fail2ban (with proper error handling)
  - |
    if systemctl is-enabled fail2ban >/dev/null 2>&1 || systemctl enable fail2ban; then
      systemctl start fail2ban
      echo "fail2ban configured successfully"
    else
      echo "Warning: fail2ban setup failed, but continuing with VM setup"
    fi

  # Install global Node.js tools as root (accessible to all users)
  - npm install -g pnpm@10.12.4
  - npm install -g bun
  - npm install -g pm2
  - npm install -g @anthropic-ai/claude-code

  # Set up proper permissions and PATH for agent user
  - chown -R agent:agent /home/agent
  - |
    echo 'export PATH="/usr/local/bin:$PATH"' >> /home/agent/.bashrc
    echo 'export PATH="/usr/bin:$PATH"' >> /home/agent/.bashrc

  # Switch to agent user for project setup
  - |
    su - agent -c '
    # Verify Node.js is available
    which node && which npm && which pnpm && which pm2 || exit 1

    # Clone and setup Vm API server
    cd /home/agent && git clone https://github.com/PatrickRogg/cloud-agent.git
    cd /home/agent/cloud-agent && pnpm --filter @repo/vm-api --filter @repo/common install --frozen-lockfile

    # Create tasks directory
    mkdir -p /home/agent/tasks

    # Create .claude directory and copy credential files
    mkdir -p /home/agent/.claude${
      claudeFiles.settingsBase64
        ? `
    echo "${claudeFiles.settingsBase64}" | base64 -d > /home/agent/.claude/settings.json`
        : ''
    }${
      claudeFiles.credentialsBase64
        ? `
    echo "${claudeFiles.credentialsBase64}" | base64 -d > /home/agent/.claude/.credentials.json`
        : ''
    }
    chown -R agent:agent /home/agent/.claude${
      claudeFiles.settingsBase64 || claudeFiles.credentialsBase64
        ? `
    chmod 600 /home/agent/.claude/settings.json /home/agent/.claude/.credentials.json 2>/dev/null || true`
        : ''
    }

    # Create ecosystem.config.js file
    cat > /home/agent/cloud-agent/ecosystem.config.js << EOF
    module.exports = {
      apps: [{
        name: "vm-api",
        script: "pnpm --filter @repo/vm-api start",
        env: {
          NODE_ENV: "production",
          API_KEY: "${vmApiKey}",
          PORT: "${CLOUD_AGENT.VM_API_PORT}",
          PATH_TO_CLAUDE_CODE_EXECUTABLE: "/usr/bin/claude",
          ${auth.anthropic.apiKey ? `ANTHROPIC_API_KEY: "${auth.anthropic.apiKey}",` : ''}${
            auth.anthropic.claudeDirectory
              ? `
          CLAUDE_HOME: "/home/agent/.claude",`
              : ''
          }
          WORKING_DIRECTORY: "/home/agent/tasks"
        }
      }]
    }
    EOF

    # Start the VM API
    cd /home/agent/cloud-agent && pm2 start ecosystem.config.js
    pm2 save
    pm2 startup ubuntu -u agent --hp /home/agent
    '

  # Set up PM2 to start on boot for the agent user
  - env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup ubuntu -u agent --hp /home/agent

final_message: "VM setup complete. VM API is running on port ${CLOUD_AGENT.VM_API_PORT}."
`;
  }
}
