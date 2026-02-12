import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Prevents Prisma from crashing during Next.js build module evaluation if DATABASE_URL is missing
const createPrismaClient = () => {
    if (typeof window === 'undefined' && !process.env.DATABASE_URL) {
        console.warn('Prisma: DATABASE_URL is missing.');
    }
    const client = new PrismaClient({
        log: ['query', 'info', 'warn', 'error'],
    });
    return client;
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
