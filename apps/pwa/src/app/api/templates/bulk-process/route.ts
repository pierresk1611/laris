import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateProgress } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const templates = await prisma.template.findMany({
            where: {
                OR: [
                    { status: 'ERROR' },
                    { status: 'NEEDS_REVIEW' },
                    { status: 'UNMAPPED' },
                    { mappedPaths: 0 }
                ]
            }
        });

        if (templates.length === 0) {
            return NextResponse.json({ success: true, message: 'No templates need mapping' });
        }

        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

        // Process in parallel with a limit to avoid overloading
        const BATCH_SIZE = 5;
        const toProcess = templates.filter(tpl => tpl.status !== 'ACTIVE' || tpl.mappedPaths === 0);
        let processedCount = 0;
        const totalToProcess = toProcess.length;

        for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
            const batch = toProcess.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (tpl) => {
                try {
                    const variants = Array.isArray((tpl as any).variants) ? (tpl as any).variants : [{}];

                    for (let vIdx = 0; vIdx < variants.length; vIdx++) {
                        const res = await fetch(`${baseUrl}/api/templates/extract-layers`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                templateId: tpl.key,
                                variantIndex: vIdx
                            })
                        });
                        await res.json();
                    }

                    processedCount++;
                    await updateProgress(
                        'BULK_MAP_PROGRESS',
                        processedCount,
                        totalToProcess,
                        `Spracovávam: ${processedCount}/${totalToProcess}`
                    );
                } catch (e) {
                    console.error(`[BulkProcess] Failed for ${tpl.key}:`, e);
                }
            }));
        }

        await updateProgress(
            'BULK_MAP_PROGRESS',
            totalToProcess,
            totalToProcess,
            'DOKONČENÉ',
            'COMPLETED'
        );

        return NextResponse.json({
            success: true,
            total: templates.length,
            processed: processedCount
        });

    } catch (error: any) {
        console.error("[BulkProcess] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
