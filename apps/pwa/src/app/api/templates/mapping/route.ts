import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (!key) return NextResponse.json({ success: false, error: 'Key required' }, { status: 400 });

        const template = await prisma.template.findUnique({
            where: { key }
        });

        // Vratime cely template aj s variantami
        return NextResponse.json({
            success: true,
            // @ts-ignore
            mapping: template?.mappingData || null, // Legacy / Default
            // @ts-ignore
            alias: template?.alias || null,
            // @ts-ignore
            variants: template?.variants || []
        });
    } catch (error: any) {
        console.error("[TemplateMapping] GET Error:", error);
        return NextResponse.json({ success: false, error: 'Database error', details: error?.message || String(error) }, { status: 503 });
    }
}

export async function POST(request: Request) {
    try {
        const { key, variantType, mappingData, totalTextLayers } = await request.json();

        if (!key) return NextResponse.json({ success: false, error: 'Key required' }, { status: 400 });

        const template = await prisma.template.findUnique({ where: { key } });
        // @ts-ignore
        const existingVariants: any[] = Array.isArray(template?.variants) ? template.variants : [];

        // Find existing variant or create a placeholder for this type
        let targetVariantIndex = existingVariants.findIndex(v => v.type === (variantType || 'MAIN'));
        if (targetVariantIndex === -1 && variantType) {
            existingVariants.push({ type: variantType, mapping: mappingData });
            targetVariantIndex = existingVariants.length - 1;
        } else if (targetVariantIndex !== -1) {
            existingVariants[targetVariantIndex].mapping = mappingData;
        }

        const mappedCount = Object.keys(mappingData || {}).length;

        let currentVariantStatus = 'ERROR';
        if (totalTextLayers !== undefined) {
            if (mappedCount >= totalTextLayers && totalTextLayers > 0) {
                currentVariantStatus = 'ACTIVE';
            } else if (mappedCount > 0) {
                currentVariantStatus = 'NEEDS_REVIEW';
            }
        } else {
            currentVariantStatus = mappedCount > 0 ? 'ACTIVE' : 'ERROR';
        }

        let allUnmapped = true;
        existingVariants.forEach((v, index) => {
            if (index !== targetVariantIndex) {
                const vMappedCount = Object.keys(v.mapping || {}).length;
                if (vMappedCount > 0) allUnmapped = false;
            }
        });
        if (mappedCount > 0) allUnmapped = false;

        let finalStatus = currentVariantStatus;
        if (currentVariantStatus === 'ERROR' && !allUnmapped) {
            finalStatus = 'NEEDS_REVIEW';
        }

        const updatedTemplate = await prisma.template.upsert({
            where: { key },
            update: {
                // @ts-ignore
                variants: existingVariants,
                mappedPaths: Object.keys(mappingData || {}).length, // Can represent current active saving
                status: finalStatus
            },
            create: {
                key,
                name: key, // default name
                // @ts-ignore
                variants: existingVariants,
                mappedPaths: Object.keys(mappingData || {}).length,
                status: finalStatus
            }
        });

        return NextResponse.json({ success: true, template: updatedTemplate });
    } catch (error: any) {
        console.error("[TemplateMapping] POST Upsert Error:", error);
        return NextResponse.json({ success: false, error: 'Failed to save mapping', details: error?.message || String(error) }, { status: 400 });
    }
}
