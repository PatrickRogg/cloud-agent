import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { PrismaClient as PrismaClientBase } from './prisma/generated/client';

declare global {
  namespace PrismaJson {}
}

export const createPrismaClient = (connectionString: string) => {
  const adapter = new PrismaLibSQL({
    url: connectionString
  });
  return new PrismaClientBase({ adapter });
};

export type PrismaClient = ReturnType<typeof createPrismaClient>;
