import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Try a simple query
        await prisma.$queryRaw`SELECT 1`;

        // Fetch all shops for inspection
        const shops = await prisma.shop.findMany();
        const shopsDiagnostic = await Promise.all(shops.map(async (s: any) => {
            let reachability = "unknown";
            try {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), 3000);
                const res = await fetch(s.url, { signal: controller.signal });
                clearTimeout(id);
                reachability = res.ok ? "UP" : `DOWN (${res.status})`;
            } catch (e: any) {
                reachability = `FAILED (${e.message})`;
            }
            return {
                id: s.id,
                url: s.url,
                has_ck: !!s.ck,
                has_cs: !!s.cs,
                reachability
            };
        }));

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
            shops: shopsDiagnostic,
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
        }, { status: 200 });
    }
}
