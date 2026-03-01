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

        // ---- 1. RESOLVE TARGET FILE (Smart Selection) ----
        let variant = null;
        const relationalFiles = templateWithFiles?.files || [];
        const legacyVariants = (template.variants as any[]) || [];

        const isPsdOrAi = (p: string) => {
            const ext = p.toLowerCase().split('.').pop();
            return ['psd', 'psdt', 'ai'].includes(ext || '');
        };

        // Try to find the specific variant index requested
        if (relationalFiles.length > 0) {
            const typeToFind = variantIndex === 0 ? 'MAIN' : variantIndex === 1 ? 'INVITE' : 'OTHER';
            variant = relationalFiles.find((f: any) => f.type === typeToFind);
            if (!variant && variantIndex < relationalFiles.length) {
                variant = relationalFiles[variantIndex];
            }
        }

        if (!variant && legacyVariants.length > 0) {
            variant = legacyVariants[variantIndex];
        }

        // SMART UPGRADE: If current selection is not PSD/AI, look for any PSD/AI in the same template
        if (variant && variant.path && !isPsdOrAi(variant.path)) {
            console.log(`[CloudExtract] Current variant ${variant.type} is not source data (${variant.path}). Searching for PSD/AI...`);
            const sourceFile = relationalFiles.find((f: any) => isPsdOrAi(f.path)) ||
                legacyVariants.find((v: any) => v.path && isPsdOrAi(v.path));

            if (sourceFile) {
                console.log(`[CloudExtract] Smart Upgrade: Using ${sourceFile.path} instead of selected image.`);
                variant = sourceFile;
            }
        }

        // ---- 2. VALIDATION & ERROR HANDLING ----
        if (!variant || !variant.path) {
            return NextResponse.json({
                success: false,
                error: `Súbor pre túto šablónu nemá definovanú cestu na Dropboxe.`,
            }, { status: 404 });
        }

        const ext = variant.path.split('.').pop()?.toLowerCase();

        // Strict Filter per User Request
        if (!['psd', 'psdt', 'ai'].includes(ext || '')) {
            return NextResponse.json({
                success: false,
                error: `Formát .${ext} nepodporuje extrakciu vrstiev. Prosím použite .psd alebo .ai súbor.`,
            }, { status: 400 });
        }

        // .ai files cannot be read by ag-psd in cloud, they need the local agent
        if (ext === 'ai') {
            // First check if DB already has layers extracted (e.g. from a past Agent run)
            if (variant.layers && Array.isArray(variant.layers) && variant.layers.length > 0) {
                console.log(`[CloudExtract] AI file detected, but layers already exist in DB. Returning saved layers.`);
                const textLayerCount = variant.layers.filter((l: any) => l.type === 'TEXT').length;
                return NextResponse.json({
                    success: true,
                    layers: variant.layers,
                    textLayerCount
                });
            }

            return NextResponse.json({
                success: false,
                error: 'AI súbory vyžadujú lokálneho Agenta (Illustrator). Počkajte na jeho pripojenie, alebo použite .psd.',
            }, { status: 400 });
        }

        // ---- 3. CLOUD EXTRACTION (PSD ONLY) ----
        const dbx = await getDropboxClient();

        console.log(`[CloudExtract] Downloading ${variant.path}...`);
        const dbxResponse = await dbx.filesDownload({ path: variant.path });

        let fileBuffer = (dbxResponse.result as any).fileBinary;
        if (!fileBuffer && (dbxResponse.result as any).fileBlob) {
            console.log(`[CloudExtract] fileBinary missing, using fileBlob.arrayBuffer()...`);
            const blob = (dbxResponse.result as any).fileBlob;
            fileBuffer = Buffer.from(await blob.arrayBuffer());
        }

        if (!fileBuffer) {
            return NextResponse.json({ success: false, error: 'Nepodarilo sa stiahnuť súbor z Dropboxu' }, { status: 500 });
        }

        console.log(`[CloudExtract] Parsing PSD...`);
        let psd;
        try {
            psd = readPsd(fileBuffer, {
                skipLayerImageData: true,
                skipCompositeImageData: true,
                skipThumbnail: true,
                throwForMissingFeatures: false
            });
        } catch (parseErr: any) {
            console.error(`[CloudExtract] ag-psd thrown error during metadata extraction:`, parseErr);
            throw parseErr;
        }

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
