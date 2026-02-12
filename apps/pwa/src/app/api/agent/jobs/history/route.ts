import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const jobs = await prisma.job.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50 // Limit to last 50 jobs for now
        });
        return NextResponse.json({ success: true, jobs });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to retrieve job history' }, { status: 500 });
    }
}
