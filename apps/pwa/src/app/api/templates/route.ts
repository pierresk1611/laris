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

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { templates } = body;

        if (!Array.isArray(templates)) {
            return NextResponse.json({ success: false, error: 'Invalid data format' }, { status: 400 });
        }

        const limit = 50; // Process in chunks if needed, but for now linear is fine for reasonable counts
        let updatedCount = 0;
        let createdCount = 0;

        for (const tpl of templates) {
            // Upsert template
            // We assume 'key' is the unique identifier (e.g. "001", "AVU 15")
            if (!tpl.key) continue;

            const result = await prisma.template.upsert({
                where: { key: tpl.key },
                update: {
                    name: tpl.name || tpl.key,
                    imageUrl: tpl.imageUrl, // Shared Link from Dropbox
                    updatedAt: new Date()
                },
                create: {
                    key: tpl.key,
                    name: tpl.name || tpl.key,
                    status: "ACTIVE",
                    imageUrl: tpl.imageUrl,
                    mappedPaths: 0
                }
            });

            // Track stats roughly
            // (prisma.upsert doesn't explicitly tell us if it created or updated easily without checking created date, 
            // but strictly speaking we just want to know it succeeded)
        }

        return NextResponse.json({ success: true, count: templates.length });
    } catch (error) {
        console.error("[TemplatesAPI] Sync Error:", error);
        return NextResponse.json({ success: false, error: 'Sync failed' }, { status: 500 });
    }
}
