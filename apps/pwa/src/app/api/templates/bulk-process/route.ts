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

        // Initialize progress
        await updateProgress('BULK_MAP_PROGRESS', 0, templates.length, 'INICIALIZÁCIA');

        let extractionQueued = 0;
        let alreadyHasLayers = 0;

        for (const tpl of templates as any[]) {
            // Check if template already has layers (mappedPaths > 0 or has variants with mapping)
            // If it has layers, it doesn't need Agent extraction, just AI mapping
            const hasLayers = tpl.mappedPaths > 0 || (Array.isArray(tpl.variants) && tpl.variants.length > 0);

            if (hasLayers) {
                alreadyHasLayers++;
                // We'll handle automatic AI mapping for these in a separate step or via a specific flag
                // For now, let's keep them in the count but focus on triggering Agent for those without layers
            } else {
                await prisma.job.create({
                    data: {
                        type: 'EXTRACT_LAYERS',
                        status: 'PENDING',
                        payload: {
                            templateId: tpl.key,
                            isBulk: true
                        }
                    }
                });
                extractionQueued++;
            }
        }

        await updateProgress(
            'BULK_MAP_PROGRESS',
            alreadyHasLayers,
            templates.length,
            `KROK 1: Čakám na Agenta (${alreadyHasLayers}/${templates.length})`
        );

        return NextResponse.json({
            success: true,
            total: templates.length,
            extractionQueued,
            alreadyHasLayers
        });

    } catch (error: any) {
        console.error("[BulkProcess] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
