// Hetzner Cloud Configuration
export const HETZNER = {
  API_BASE_URL: 'https://api.hetzner.cloud/v1',
  DEFAULT_REGION: 'fsn1',
  DEFAULT_INSTANCE_TYPE: 'cpx11',
  DEFAULT_IMAGE: 'ubuntu-24.04',
  SUPPORTED_REGIONS: [
    'fsn1', // Falkenstein, Germany
    'nbg1', // Nuremberg, Germany
    'hel1', // Helsinki, Finland
    'ash', // Ashburn, VA, USA
    'hil' // Hillsboro, OR, USA
  ],
  SUPPORTED_INSTANCE_TYPES: [
    'cpx11', // 2 vCPU, 2 GB RAM
    'cpx21', // 3 vCPU, 4 GB RAM
    'cpx31', // 4 vCPU, 8 GB RAM
    'cpx41', // 8 vCPU, 16 GB RAM
    'cpx51' // 16 vCPU, 32 GB RAM
  ]
} as const;
