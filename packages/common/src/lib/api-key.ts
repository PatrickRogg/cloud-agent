import { randomBytes, randomUUID } from 'crypto';

export function generateApiKey(prefix: string): string {
  const randomPart = randomBytes(32).toString('hex');
  return `${prefix}_${randomPart}`;
}
