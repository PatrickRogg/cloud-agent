/**
 * Storage-specific error types
 */

export class StorageError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

// Storage Error Codes
export const STORAGE_ERROR_CODES = {
  STORAGE_READ_ERROR: 'STORAGE_READ_ERROR',
  STORAGE_WRITE_ERROR: 'STORAGE_WRITE_ERROR',
  STORAGE_CONNECTION_ERROR: 'STORAGE_CONNECTION_ERROR',
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_MISSING: 'CONFIG_MISSING'
} as const;
