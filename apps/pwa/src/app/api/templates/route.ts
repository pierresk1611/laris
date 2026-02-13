import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // @ts-ignore
        const templates = await prisma.template.findMany({
            orderBy: { key: 'asc' }
        });

        return NextResponse.json({ success: true, templates });
    } catch (error) {
        console.error("[TemplatesAPI] Error:", error);
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }
}
