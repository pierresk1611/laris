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

        // Try to get files from TemplateFile relation first
        const templateWithFiles = await prisma.template.findUnique({
            where: { id: template.id },
            include: { files: true }
        }) as any;

        let variant = null;
        const relationalFiles = templateWithFiles?.files || [];
        const legacyVariants = (template.variants as any[]) || [];

        if (relationalFiles.length > 0) {
            // Find by type (MAIN = 0, INVITE = 1)
            const typeToFind = variantIndex === 0 ? 'MAIN' : 'INVITE';
            variant = relationalFiles.find((f: any) => f.type === typeToFind);
            if (!variant && variantIndex < relationalFiles.length) {
                variant = relationalFiles[variantIndex];
            }
        }

        // Fallback to legacy variants if missing
        if (!variant && legacyVariants.length > 0) {
            variant = legacyVariants[variantIndex];
        }

        // Smart PSD Selection: If the current variant is not a PSD/PSDT, try to find one in the template's files
        const isPsd = (p: string) => p.toLowerCase().endsWith('.psd') || p.toLowerCase().endsWith('.psdt');

        if (variant && variant.path && !isPsd(variant.path)) {
            console.log(`[CloudExtract] Current variant ${variant.type} is not a PSD (${variant.path}). Searching for alternatives...`);
            const psdFile = relationalFiles.find((f: any) => isPsd(f.path));
            if (psdFile) {
                console.log(`[CloudExtract] Found alternative PSD: ${psdFile.path}`);
                variant = psdFile;
            }
        }

        if (!variant || !variant.path) {
            const variantCode = variantIndex === 0 ? 'O' : 'P';
            const errorMsg = `Súbor pre variant ${variantCode} nemá definovanú cestu na Dropboxe.`;

            console.error(`[CloudExtract] CRITICAL: Database record for ${templateId} ${variantCode} is missing path.`, {
                templateId,
                variantIndex,
                hasRelational: relationalFiles.length > 0,
                hasLegacy: legacyVariants.length > 0
            });

            return NextResponse.json({
                success: false,
                error: errorMsg,
                details: `Missing path for template ${templateId} variant ${variantCode}`
            }, { status: 404 });
        }

        // Final format check
        const ext = variant.path.split('.').pop()?.toLowerCase();
        if (ext !== 'psd' && ext !== 'psdt') {
            // Check if it's an image
            const isImage = ['png', 'jpg', 'jpeg'].includes(ext || '');
            if (isImage) {
                return NextResponse.json({
                    success: false,
                    error: 'Toto je len obrázok náhľadu. Vrstvy sa dajú čítať len zo zdrojového PSD. Priložte k šablóne .psd súbor.',
                }, { status: 400 });
            }

            // For AI files, we still can't use ag-psd, but we should inform the user to use PSD or wait for Print Agent for PDF.
            // But per user request: "Zrušenie Agenta pre mapovanie".
            return NextResponse.json({
                success: false,
                error: 'Mapovanie vrstiev v cloude podporuje len .psd/.psdt. Pre .ai súbory prosím uložte kópiu ako .psd.',
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
        const currentVariants = (template.variants as any[]) || [];
        const updatedVariants = [...currentVariants];

        if (updatedVariants[variantIndex]) {
            updatedVariants[variantIndex] = {
                ...updatedVariants[variantIndex],
                layers: extractedLayers
            };
        } else {
            // If for some reason it's missing from the index but we have the variant variable
            updatedVariants[variantIndex] = {
                ...variant,
                layers: extractedLayers
            };
        }

        const finalStatus = isNoPdfAi ? 'WARNING_NO_PDF' : 'NEEDS_REVIEW';

        // Update Template in DB (legacy and metadata)
        await prisma.template.update({
            where: { id: template.id },
            data: {
                variants: updatedVariants as any,
                mappedPaths: textLayerCount,
                status: finalStatus,
                updatedAt: new Date()
            }
        });

        // ALSO Update TemplateFile record if it exists for this type
        const typeToUpdate = variantIndex === 0 ? 'MAIN' : 'INVITE';
        await prisma.templateFile.updateMany({
            where: {
                templateId: template.id,
                type: typeToUpdate
            },
            data: {
                layers: extractedLayers as any
            }
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
                    variantType: variant.type,
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
