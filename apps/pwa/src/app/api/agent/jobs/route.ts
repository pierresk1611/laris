import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings';

// Helper to validate Agent Token
async function validateAgent(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false;
    }
    const token = authHeader.split(' ')[1];
    const storedToken = await getSetting('AGENT_ACCESS_TOKEN');
    return token === storedToken;
}

// GET: Fetch pending jobs
export async function GET(req: Request) {
    if (!await validateAgent(req)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING';
    const type = searchParams.get('type');

    try {
        const whereClause: any = { status };
        if (type) whereClause.type = type;

        const jobs = await prisma.job.findMany({
            where: whereClause,
            orderBy: { createdAt: 'asc' },
            take: 1 // Fetch 1 job at a time to avoid conflicts? Agent handles one by one anyway.
        });

        return NextResponse.json({ success: true, jobs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PATCH: Update job status
export async function PATCH(req: Request) {
    if (!await validateAgent(req)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, status, result } = body;

        if (!id || !status) {
            return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
        }

        const job = await prisma.job.update({
            where: { id },
            data: {
                status,
                result: result || undefined,
                updatedAt: new Date()
            }
        });

        // Trigger side-effects if DONE
        if (job.status === 'DONE' && (job.type === 'SCAN_LAYERS' || job.type === 'EXTRACT_LAYERS') && job.result) {
            const resultData = job.result as any;
            const layers = resultData.layers || [];
            const payload = job.payload as any;
            const templateId = payload.templateId;

            if (templateId) {
                // Update template with found layers
                const totalTextLayers = Array.isArray(layers) ? layers.filter((l: any) => l.type === 'TEXT').length : 0;

                // Fetch template to maintain variants
                const template = await prisma.template.findUnique({ where: { key: templateId } });
                // @ts-ignore
                const existingVariants: any[] = Array.isArray(template?.variants) ? template.variants : [];

                // If it's a simple extraction (not SCAN_LAYERS with verification)
                const updateData: any = { mappingData: { layers } };
                if (resultData.previewUrl) {
                    updateData.imageUrl = resultData.previewUrl;
                }

                if (job.type === 'EXTRACT_LAYERS') {
                    // Update current variant (default MAIN) with the new layers count for UI feedback
                    updateData.mappedPaths = totalTextLayers;
                    updateData.status = 'NEEDS_REVIEW';
                    await prisma.template.update({
                        where: { key: templateId },
                        data: updateData
                    });
                } else if (job.type === 'SCAN_LAYERS') {
                    // Verification Logic (Existing)
                    const requiredLayers = ['NAME_MAIN', 'DATE_MAIN', 'BODY_FULL'];
                    const hasRequiredLayer = Array.isArray(layers) && layers.some((l: any) => requiredLayers.includes(typeof l === 'string' ? l : l.name));

                    updateData.isVerified = hasRequiredLayer;
                    updateData.status = hasRequiredLayer ? 'ACTIVE' : 'UNMAPPED';
                    await prisma.template.update({
                        where: { key: templateId },
                        data: updateData
                    });
                }

                // AI AUTO-MAPPING TRIGGER (For Bulk or Auto-Map flow)
                if (payload.isBulk || payload.autoMap) {
                    try {
                        console.log(`[JobSideEffect] Triggering AI Mapping for ${templateId}...`);
                        // We call our own AI mapping endpoint internally
                        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
                        await fetch(`${baseUrl}/api/ai/map-layers`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                templateId,
                                layers: layers // The layers we just extracted
                            })
                        });
                    } catch (e) {
                        console.error(`[JobSideEffect] AI Mapping trigger failed for ${templateId}`, e);
                    }
                }

                // PROGRESS UPDATE (For Bulk flow)
                if (payload.isBulk) {
                    const progressJson = await getSetting('BULK_MAP_PROGRESS');
                    if (progressJson) {
                        const progress = JSON.parse(progressJson);
                        const newProcessed = progress.processed + 1;
                        const label = newProcessed >= progress.total
                            ? 'DOKONČENÉ'
                            : `KROK 2: AI mapuje vrstvy (${newProcessed}/${progress.total})`;

                        // Use the helper to update
                        const startTime = new Date().toISOString();
                        const value = JSON.stringify({
                            ...progress,
                            processed: newProcessed,
                            label,
                            status: newProcessed >= progress.total ? 'COMPLETED' : 'RUNNING',
                            updatedAt: startTime
                        });

                        await prisma.setting.upsert({
                            where: { id: 'BULK_MAP_PROGRESS' },
                            update: { value },
                            create: { id: 'BULK_MAP_PROGRESS', value, category: 'EPHEMERAL', isSecret: false }
                        });
                    }
                }
            }
        }

        return NextResponse.json({ success: true, job });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST: Create a new job (from Client)
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { type, payload } = body;

        if (!type || !payload) {
            return NextResponse.json({ success: false, message: 'Missing type or payload' }, { status: 400 });
        }

        const job = await prisma.job.create({
            data: {
                type,
                status: 'PENDING',
                payload: payload // JSON
            }
        });

        return NextResponse.json({ success: true, job });
    } catch (error: any) {
        console.error("Create Job Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
