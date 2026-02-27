import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
    try {
        // Create a new SYSTEM_SCAN job
        const job = await prisma.job.create({
            data: {
                type: 'SYSTEM_SCAN',
                status: 'PENDING',
                payload: {}
            }
        });

        return NextResponse.json({ success: true, jobId: job.id });
    } catch (error) {
        console.error("[ScanAPI] Error creating job:", error);
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }
}
