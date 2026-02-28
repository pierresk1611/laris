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

        // Use a base URL for internal API calls
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

        const hasLayersFilter = (tpl: any) => tpl.mappedPaths > 0 || (Array.isArray(tpl.variants) && tpl.variants.length > 0);
        const alreadyHasLayers = (templates as any[]).filter(hasLayersFilter).length;
        let processedCount = alreadyHasLayers;

        // Process in parallel with a limit to avoid overloading
        const BATCH_SIZE = 5;
        const toProcess = (templates as any[]).filter(tpl => !hasLayersFilter(tpl));

        for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
            const batch = toProcess.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (tpl) => {
                try {
                    // Trigger cloud extraction (which also triggers AI mapping)
                    const res = await fetch(`${baseUrl}/api/templates/extract-layers`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ templateId: tpl.key })
                    });
                    const data = await res.json();

                    if (data.success) {
                        processedCount++;
                        await updateProgress(
                            'BULK_MAP_PROGRESS',
                            processedCount,
                            templates.length,
                            `Spracovávam: ${processedCount}/${templates.length}`
                        );
                    }
                } catch (e) {
                    console.error(`[BulkProcess] Failed for ${tpl.key}:`, e);
                }
            }));
        }

        // Final completion update
        await updateProgress(
            'BULK_MAP_PROGRESS',
            templates.length,
            templates.length,
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
