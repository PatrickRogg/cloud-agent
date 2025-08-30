// Error types
export class VmError extends Error {
  constructor(
    message: string,
    public code: string,
    public vmId?: string
  ) {
    super(message);
    this.name = 'VmError';
  }
}
