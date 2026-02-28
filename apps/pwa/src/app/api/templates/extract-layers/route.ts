import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDropboxClient } from '@/lib/dropbox';
// @ts-ignore
import { readPsd } from 'ag-psd';

export const dynamic = 'force-dynamic';

interface LayerInfo {
    name: string;
    type: 'TEXT' | 'IMAGE' | 'GROUP';
    mapping?: string | null;
}

function extractLayersRecursive(children: any[]): LayerInfo[] {
    let layers: LayerInfo[] = [];

    for (const child of children) {
        if (child.children && child.children.length > 0) {
            // It's a group
            layers.push({ name: child.name, type: 'GROUP' });
            layers = [...layers, ...extractLayersRecursive(child.children)];
        } else {
            // It's a layer
            const type = (child.text && child.text.text) ? 'TEXT' : 'IMAGE';
            layers.push({ name: child.name, type });
        }
    }

    return layers;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { templateId, variantIndex = 0 } = body;

        if (!templateId) {
            return NextResponse.json({ success: false, error: 'Missing templateId' }, { status: 400 });
        }

        const template = await prisma.template.findUnique({
            where: { key: templateId }
        });

        if (!template) {
            return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
        }

        const variants = ((template as any).variants as any[]) || [];
        const variant = variants[variantIndex];

        if (!variant || !variant.path) {
            return NextResponse.json({ success: false, error: 'Variant or path not found' }, { status: 404 });
        }

        // Only handle PSD/PSDT for cloud extraction
        const ext = variant.path.split('.').pop()?.toLowerCase();
        if (ext !== 'psd' && ext !== 'psdt') {
            return NextResponse.json({
                success: false,
                error: 'Cloud extraction only supports .psd and .psdt files. For .ai files, use the Agent.',
                requiresAgent: true
            });
        }

        const dbx = await getDropboxClient();

        console.log(`[CloudExtract] Downloading ${variant.path}...`);
        const dbxResponse = await dbx.filesDownload({ path: variant.path });
        const fileBuffer = (dbxResponse.result as any).fileBinary;

        if (!fileBuffer) {
            return NextResponse.json({ success: false, error: 'Failed to download file from Dropbox' }, { status: 500 });
        }

        console.log(`[CloudExtract] Parsing PSD (skipping image data)...`);
        const psd = readPsd(fileBuffer, {
            skipLayerImageData: true,
            skipCompositeImageData: true,
            skipThumbnail: true
        });

        const extractedLayers = psd.children ? extractLayersRecursive(psd.children) : [];

        // Check for Illustrator PDF compatibility warning
        const isNoPdfAi = extractedLayers.some(l =>
            l.name.includes("Adobe Illustrator") ||
            (l.type === 'TEXT' && l.name.toLowerCase().includes("pdf compatibility"))
        );

        const textLayerCount = extractedLayers.filter(l => l.type === 'TEXT').length;
        console.log(`[CloudExtract] Found ${extractedLayers.length} layers (${textLayerCount} text).`);

        // Update Template variants in DB
        const updatedVariants = [...variants];
        updatedVariants[variantIndex] = {
            ...variant,
            layers: extractedLayers
        };

        const finalStatus = isNoPdfAi ? 'WARNING_NO_PDF' : 'NEEDS_REVIEW';

        await prisma.template.update({
            where: { key: templateId },
            data: {
                variants: updatedVariants as any,
                mappedPaths: textLayerCount,
                status: finalStatus,
                updatedAt: new Date()
            } as any
        });

        if (isNoPdfAi) {
            return NextResponse.json({
                success: false,
                error: 'Tento AI súbor je treba preuložiť so zapnutým "Create PDF Compatible File".',
                status: 'WARNING_NO_PDF'
            });
        }

        // Trigger AI Auto-Map
        try {
            console.log(`[CloudExtract] Triggering AI Auto-Map for ${templateId}...`);
            const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
            const aiRes = await fetch(`${baseUrl}/api/ai/map-layers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId,
                    variantIndex,
                    layers: extractedLayers
                })
            });
            const aiData = await aiRes.json();
            console.log(`[CloudExtract] AI Auto-Map status: ${aiData.success ? 'Success' : 'Failed'}`);
        } catch (aiErr) {
            console.error(`[CloudExtract] AI Auto-Map trigger failed:`, aiErr);
        }

        return NextResponse.json({
            success: true,
            layers: extractedLayers,
            textLayerCount
        });

    } catch (error: any) {
        console.error("[CloudExtract] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
