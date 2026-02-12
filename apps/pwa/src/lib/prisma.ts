import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Prevents Prisma from crashing during Next.js build module evaluation if DATABASE_URL is missing
const createPrismaClient = () => {
    if (typeof window === 'undefined' && !process.env.DATABASE_URL) {
        console.warn('Prisma: DATABASE_URL is missing. Skipping client instantiation during build evaluation.');
    }
    return new PrismaClient({
        log: ['query'],
    });
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
