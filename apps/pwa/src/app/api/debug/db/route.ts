import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Try a simple query
        await prisma.$queryRaw`SELECT 1`;

        // Try to get some metadata without exposing sensitive info
        const url = process.env.DATABASE_URL || 'MISSING';
        const maskedUrl = url.replace(/:[^:@]+@/, ':****@');
        const hostMatch = url.match(/@([^:/?#]+)/);
        const host = hostMatch ? hostMatch[1] : 'unknown';

        return NextResponse.json({
            success: true,
            status: 'Connected',
            host: host,
            masked_url: maskedUrl,
            env_keys: Object.keys(process.env).filter(k => k.includes('URL') || k.includes('DB'))
        });
    } catch (error: any) {
        const url = process.env.DATABASE_URL || 'MISSING';
        const hostMatch = url.match(/@([^:/?#]+)/);
        const host = hostMatch ? hostMatch[1] : 'unknown';

        return NextResponse.json({
            success: false,
            status: 'Disconnected',
            error: error.message,
            detected_host: host,
            env_keys: Object.keys(process.env).filter(k => k.includes('URL') || k.includes('DB'))
        }, { status: 500 });
    }
}
