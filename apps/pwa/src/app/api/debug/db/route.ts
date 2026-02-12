import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Try a simple query
        await prisma.$queryRaw`SELECT 1`;

        const dbUrl = process.env.DATABASE_URL || 'MISSING';
        const directUrl = process.env.DIRECT_URL || 'MISSING';

        const mask = (url: string) => url.replace(/:[^:@]+@/, ':****@').replace(/@([^:/?#]+)/, '@[HOST]');
        const getHost = (url: string) => url.match(/@([^:/?#]+)/)?.[1] || 'unknown';

        return NextResponse.json({
            success: true,
            status: 'Connected',
            database_url_host: getHost(dbUrl),
            direct_url_host: getHost(directUrl),
            masked_database_url: mask(dbUrl),
            env_keys: Object.keys(process.env).filter(k => k.includes('URL') || k.includes('DB'))
        });
    } catch (error: any) {
        const dbUrl = process.env.DATABASE_URL || 'MISSING';
        const directUrl = process.env.DIRECT_URL || 'MISSING';
        const getHost = (url: string) => url.match(/@([^:/?#]+)/)?.[1] || 'unknown';

        return NextResponse.json({
            success: false,
            status: 'Disconnected',
            error: error.message,
            detected_db_host: getHost(dbUrl),
            detected_direct_host: getHost(directUrl),
            env_keys: Object.keys(process.env).filter(k => k.includes('URL') || k.includes('DB'))
        }, { status: 200 }); // Return 200 so we can actually see the JSON body easily
    }
}
