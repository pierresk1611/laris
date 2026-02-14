import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings';

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
        // Upsert Agent Status
        // We assume single agent for now, or identify by hostname?
        // Let's use a fixed ID or hostname if available.
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
