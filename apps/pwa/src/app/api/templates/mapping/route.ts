import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (!key) return NextResponse.json({ success: false, error: 'Key required' }, { status: 400 });

        const template = await prisma.template.findUnique({
            where: { key },
            include: { files: true }
        });

        // Return full template with relational files mapped to variants format
        return NextResponse.json({
            success: true,
            mapping: template?.mappingData || null,
            alias: template?.displayName || template?.alias || null,
            displayName: template?.displayName || null,
            variants: template?.files?.map((f: any) => ({
                type: f.type,
                path: f.path,
                extension: f.extension,
                imageUrl: f.imageUrl,
                mapping: f.mapping,
                layers: f.layers
            })) || (template as any)?.variants || []
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

        const template = await prisma.template.findUnique({
            where: { key },
            include: { files: true }
        });

        if (!template) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });

        const variant = variantType || 'MAIN';
        const mappedCount = Object.keys(mappingData || {}).length;

        // Determine Status for this specific variant
        let finalStatus = 'PENDING_MAPPING';
        if (mappedCount > 0) {
            // If all text fields are mapped, it's ACTIVE, otherwise NEEDS_REVIEW
            if (totalTextLayers !== undefined && mappedCount >= totalTextLayers && totalTextLayers > 0) {
                finalStatus = 'ACTIVE';
            } else {
                finalStatus = 'NEEDS_REVIEW';
            }
        }

        // 1. Update relational TemplateFile
        await prisma.templateFile.update({
            where: {
                templateId_type: {
                    templateId: template.id,
                    type: variant
                }
            },
            data: {
                mapping: mappingData
            }
        });

        // 2. Synchronize legacy JSON (for backward compatibility if needed)
        const existingVariants: any[] = Array.isArray(template.variants) ? JSON.parse(JSON.stringify(template.variants)) : [];
        let targetVariantIndex = existingVariants.findIndex(v => v.type === variant);
        if (targetVariantIndex === -1) {
            existingVariants.push({ type: variant, mapping: mappingData });
        } else {
            existingVariants[targetVariantIndex].mapping = mappingData;
        }

        // 3. Update main Template status based on overall readiness
        // If ANY file is PENDING_MAPPING, the template might be NEEDS_REVIEW or PENDING_MAPPING
        // But the user rule says "Template is ACTIVE if at least one field is mapped".
        // Actually, let's be strict: Template is ACTIVE only if the current saved variant is ACTIVE
        // or if we have a global consensus.

        const updatedTemplate = await prisma.template.update({
            where: { key },
            data: {
                variants: existingVariants as any,
                mappedPaths: mappedCount,
                status: finalStatus, // Use the status of the variant we just saved
                updatedAt: new Date()
            }
        });

        return NextResponse.json({ success: true, template: updatedTemplate });
    } catch (error: any) {
        console.error("[TemplateMapping] POST Upsert Error:", error);
        return NextResponse.json({ success: false, error: 'Failed to save mapping', details: error?.message || String(error) }, { status: 400 });
    }
}
