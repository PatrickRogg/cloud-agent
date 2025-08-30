import { randomUUIDv7 } from 'bun';

export function uuid(): string {
  return randomUUIDv7();
}
