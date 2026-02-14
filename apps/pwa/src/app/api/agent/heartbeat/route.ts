import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings';

// GET: Check Agent Status (for Frontend)
export async function GET() {
    try {
        const status = await prisma.agentStatus.findFirst({
            orderBy: { lastSeen: 'desc' }
        });

        if (!status) {
            return NextResponse.json({ online: false, lastSeen: null });
        }

        const now = new Date().getTime();
        const lastSeen = new Date(status.lastSeen).getTime();
        const isOnline = (now - lastSeen) < 60000; // 1 minute threshold

        return NextResponse.json({
            online: isOnline,
            lastSeen: status.lastSeen,
            version: status.version,
            os: status.os
        });
    } catch (error: any) {
        return NextResponse.json({ online: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const storedToken = await getSetting('AGENT_ACCESS_TOKEN'); // Using settings helper logic

    if (token !== storedToken) {
        return NextResponse.json({ success: false, message: 'Invalid Token' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const agentId = 'default-agent'; // Simple single agent setup

        await prisma.agentStatus.upsert({
            where: { id: agentId },
            update: {
                lastSeen: new Date(),
                status: body.status || 'ONLINE',
                version: body.version,
                os: body.os
            },
            create: {
                id: agentId,
                lastSeen: new Date(),
                status: body.status || 'ONLINE',
                version: body.version,
                os: body.os
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
