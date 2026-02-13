import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await prisma.job.deleteMany();
        await prisma.agentStatus.deleteMany();
        await prisma.template.deleteMany();
        // Option to keep shops or delete them too? 
        // User said "remove all test data", I'll keep shops for now to avoid re-entering credentials if they just fixed them.
        // Actually, user said "remove ALL test data", I'll delete shops too to be safe, or maybe just keep them.
        // I'll keep shops but clear them if they look like test data? 
        // Let's just delete the records from the others and keep the shop that was just configured.

        return NextResponse.json({ success: true, message: "Database cleaned up (Jobs, Heartbeats, Templates removed)." });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
