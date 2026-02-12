import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const pendingJobs = await prisma.job.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, jobs: pendingJobs });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 503 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const newJob = await prisma.job.create({
            data: {
                type: body.type,
                payload: body.payload || {},
                status: 'PENDING'
            }
        });

        return NextResponse.json({ success: true, job: newJob });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to create job' }, { status: 400 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { id, status, result } = await request.json();

        const updatedJob = await prisma.job.update({
            where: { id },
            data: {
                status,
                result: result || {}
            }
        });

        return NextResponse.json({ success: true, job: updatedJob });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Job update failed' }, { status: 400 });
    }
}
