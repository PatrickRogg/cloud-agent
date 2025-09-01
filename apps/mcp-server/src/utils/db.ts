import { createPrismaClient } from '@repo/database/client';

export const db = createPrismaClient(process.env.DATABASE_URL!);
