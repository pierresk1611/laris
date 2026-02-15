import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // @ts-ignore
        const inboxItems = await prisma.fileInbox.findMany({
            where: {
                status: 'UNCLASSIFIED'
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json({ success: true, items: inboxItems });
    } catch (error) {
        console.error("[InboxAPI] Error:", error);
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }
}
