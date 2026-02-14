import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings';

// Helper to validate Agent Token
async function validateAgent(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false;
    }
    const token = authHeader.split(' ')[1];
    const storedToken = await getSetting('AGENT_ACCESS_TOKEN');
    return token === storedToken;
}

// GET: Fetch pending jobs
export async function GET(req: Request) {
    if (!await validateAgent(req)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING';

    try {
        const jobs = await prisma.job.findMany({
            where: { status: status },
            orderBy: { createdAt: 'asc' },
            take: 1 // Fetch 1 job at a time to avoid conflicts? Agent handles one by one anyway.
        });

        return NextResponse.json({ success: true, jobs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PATCH: Update job status
export async function PATCH(req: Request) {
    if (!await validateAgent(req)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, status, result } = body;

        if (!id || !status) {
            return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
        }

        const job = await prisma.job.update({
            where: { id },
            data: {
                status,
                result: result || undefined,
                updatedAt: new Date()
            }
        });

        // Trigger side-effects if DONE? (e.g. Update Order Status)
        // For now, just update the Job record.

        return NextResponse.json({ success: true, job });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
