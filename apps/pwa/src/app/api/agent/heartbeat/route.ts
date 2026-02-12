import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const latestStatus = await prisma.agentStatus.findFirst({
            orderBy: { lastSeen: 'desc' }
        });

        const isOnline = latestStatus
            ? Date.now() - new Date(latestStatus.lastSeen).getTime() < 30000 // 30s threshold
            : false;

        return NextResponse.json({
            online: isOnline,
            lastSeen: latestStatus?.lastSeen || null,
            details: latestStatus
        });
    } catch (error) {
        return NextResponse.json({ online: false, error: 'Database not accessible' }, { status: 503 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const status = await prisma.agentStatus.upsert({
            where: { id: 'default-agent' },
            update: {
                lastSeen: new Date(),
                version: body.version || '1.0.0',
                os: body.os || 'unknown',
                status: 'ONLINE'
            },
            create: {
                id: 'default-agent',
                lastSeen: new Date(),
                version: body.version || '1.0.0',
                os: body.os || 'unknown',
                status: 'ONLINE'
            }
        });

        return NextResponse.json({ success: true, updated: status });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Heartbeat failed' }, { status: 400 });
    }
}
