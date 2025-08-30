export interface HetznerServer {
  id: number;
  name: string;
  status: 'initializing' | 'starting' | 'running' | 'stopping' | 'off' | 'deleting' | 'migrating' | 'rebuilding' | 'unknown';
  created: string;
  public_net: {
    ipv4: {
      id: number;
      ip: string;
      blocked: boolean;
      dns_ptr: string;
    } | null;
    ipv6: {
      id: number;
      ip: string;
      blocked: boolean;
      dns_ptr: Array<{
        ip: string;
        dns_ptr: string;
      }>;
    } | null;
    floating_ips: number[];
    firewalls: Array<{
      id: number;
      status: 'applied' | 'pending';
    }>;
  };
  private_net: Array<{
    network: number;
    ip: string;
    alias_ips: string[];
    mac_address: string;
  }>;
  server_type: {
    id: number;
    name: string;
    description: string;
    cores: number;
    memory: number;
    disk: number;
    deprecated: boolean;
    prices: Array<{
      location: string;
      price_hourly: {
        net: string;
        gross: string;
      };
      price_monthly: {
        net: string;
        gross: string;
      };
      included_traffic: number;
      price_per_tb_traffic: {
        net: string;
        gross: string;
      };
    }>;
    storage_type: 'local' | 'network';
    cpu_type: 'shared' | 'dedicated';
    category: string;
    architecture: 'x86' | 'arm';
    deprecation?: {
      unavailable_after: string;
      announced: string;
    };
  };
  datacenter: {
    id: number;
    name: string;
    description: string;
    location: {
      id: number;
      name: string;
      description: string;
      country: string;
      city: string;
      latitude: number;
      longitude: number;
      network_zone: string;
    };
    server_types: {
      supported: number[];
      available: number[];
      available_for_migration: number[];
    };
  };
  image: {
    id: number;
    type: 'system' | 'snapshot' | 'backup' | 'app';
    status: 'available' | 'creating';
    name: string;
    description: string;
    image_size: number | null;
    disk_size: number;
    created: string;
    created_from: {
      id: number;
      name: string;
    } | null;
    bound_to: number | null;
    os_flavor: string;
    os_version: string | null;
    rapid_deploy: boolean;
    protection: {
      delete: boolean;
    };
    deprecated: string | null;
    deleted: string | null;
    labels: Record<string, string>;
    architecture: 'x86' | 'arm';
  };
  iso: {
    id: number;
    name: string;
    description: string;
    type: 'public' | 'private';
    deprecation?: {
      unavailable_after: string;
      announced: string;
    };
    architecture: 'x86' | 'arm';
  } | null;
  rescue_enabled: boolean;
  locked: boolean;
  backup_window: string | null;
  outgoing_traffic: number | null;
  ingoing_traffic: number | null;
  included_traffic: number;
  protection: {
    delete: boolean;
    rebuild: boolean;
  };
  labels: Record<string, string>;
  volumes: number[];
  load_balancers: number[];
  primary_disk_size: number;
  placement_group?: {
    id: number;
    name: string;
    labels: Record<string, string>;
    type: string;
    created: string;
    servers: number[];
  };
}

export interface HetznerCreateServerRequest {
  name: string;
  location?: string;
  datacenter?: string;
  server_type: string;
  start_after_create?: boolean;
  image: string;
  placement_group?: number;
  ssh_keys?: string[];
  volumes?: number[];
  networks?: number[];
  firewalls?: Array<{
    firewall: number;
  }>;
  user_data?: string;
  labels?: Record<string, string>;
  automount?: boolean;
  public_net?: {
    enable_ipv4?: boolean;
    enable_ipv6?: boolean;
    ipv4?: number | null;
    ipv6?: number | null;
  };
}

export interface HetznerCreateServerResponse {
  server: HetznerServer;
  action: HetznerAction;
  next_actions: HetznerAction[];
  root_password: string | null;
}

export interface HetznerAction {
  id: number;
  command: string;
  status: 'running' | 'success' | 'error';
  progress: number;
  started: string;
  finished: string | null;
  resources: Array<{
    id: number;
    type: string;
  }>;
  error?: {
    code: string;
    message: string;
  };
}

export interface HetznerListServersResponse {
  servers: HetznerServer[];
  meta: {
    pagination: {
      page: number;
      per_page: number;
      previous_page: number | null;
      next_page: number | null;
      last_page: number;
      total_entries: number;
    };
  };
}

export interface HetznerImage {
  id: number;
  type: 'system' | 'snapshot' | 'backup' | 'app';
  status: 'available' | 'creating';
  name: string;
  description: string;
  image_size: number | null;
  disk_size: number;
  created: string;
  created_from: {
    id: number;
    name: string;
  } | null;
  bound_to: number | null;
  os_flavor: string;
  os_version: string | null;
  rapid_deploy: boolean;
  protection: {
    delete: boolean;
  };
  deprecated: string | null;
  deleted: string | null;
  labels: Record<string, string>;
  architecture: 'x86' | 'arm';
}

export interface HetznerListImagesResponse {
  images: HetznerImage[];
  meta: {
    pagination: {
      page: number;
      per_page: number;
      previous_page: number | null;
      next_page: number | null;
      last_page: number;
      total_entries: number;
    };
  };
}

export interface HetznerSshKey {
  id: number;
  name: string;
  fingerprint: string;
  public_key: string;
  labels: Record<string, string>;
  created: string;
}

export interface HetznerListSshKeysResponse {
  ssh_keys: HetznerSshKey[];
  meta: {
    pagination: {
      page: number;
      per_page: number;
      previous_page: number | null;
      next_page: number | null;
      last_page: number;
      total_entries: number;
    };
  };
}

export interface HetznerCreateSshKeyRequest {
  name: string;
  public_key: string;
  labels?: Record<string, string>;
}

export interface HetznerCreateSshKeyResponse {
  ssh_key: HetznerSshKey;
}
