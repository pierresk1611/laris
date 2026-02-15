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

    try {
        const jobs = await prisma.job.findMany({
            where: { status: status },
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
        if (job.status === 'DONE' && job.type === 'SCAN_LAYERS' && job.result) {
            const resultData = job.result as any;
            const layers = resultData.layers || [];

            // Verification Logic
            const requiredLayers = ['NAME_MAIN', 'DATE_MAIN', 'BODY_FULL'];
            const hasRequiredLayer = layers.some((l: string) => requiredLayers.includes(l));

            const payload = job.payload as any;
            const templateId = payload.templateId; // We added this in aggregate route

            if (templateId) {
                if (hasRequiredLayer) {
                    await prisma.template.update({
                        where: { id: templateId },
                        data: {
                            isVerified: true,
                            status: 'ACTIVE',
                            // We can also store the mapping data if needed
                            mappingData: { layers }
                        }
                    });
                    console.log(`[JobComplete] Template ${templateId} VERIFIED ✅`);
                } else {
                    await prisma.template.update({
                        where: { id: templateId },
                        data: {
                            isVerified: false,
                            status: 'UNMAPPED',
                            mappingData: { layers }
                        }
                    });
                    console.log(`[JobComplete] Template ${templateId} UNMAPPED ❌`);
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
