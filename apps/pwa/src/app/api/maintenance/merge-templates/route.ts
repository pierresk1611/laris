import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        // @ts-ignore
        const templates = await prisma.template.findMany();

        const merges: { source: string, target: string, type: string }[] = [];
        let deletedCount = 0;
        let updatedCount = 0;

        for (const tpl of templates) {
            // Check if this template key ends with _P or _O
            const match = tpl.key.match(/^(.*?)_([PO])$/i);

            if (match) {
                const baseKey = match[1];
                const variantType = match[2];

                // Check if base exist, or create it
                // @ts-ignore
                let baseTemplate = await prisma.template.findUnique({ where: { key: baseKey } });

                if (!baseTemplate) {
                    // Create base template by stealing properties
                    // @ts-ignore
                    baseTemplate = await prisma.template.create({
                        data: {
                            key: baseKey,
                            name: baseKey,
                            status: tpl.status,
                            imageUrl: tpl.imageUrl,
                            variants: []
                        }
                    });
                }

                // Append variant data if needed
                const existingVariants: any[] = (baseTemplate.variants as any[]) || [];

                // Avoid pushing duplicates
                if (!existingVariants.find(v => v.key === tpl.key)) {
                    existingVariants.push({
                        key: tpl.key,
                        type: variantType.toUpperCase(),
                        imageUrl: tpl.imageUrl
                    });

                    // @ts-ignore
                    await prisma.template.update({
                        where: { key: baseKey },
                        data: {
                            variants: existingVariants,
                            imageUrl: baseTemplate.imageUrl || tpl.imageUrl // use first available image
                        }
                    });
                    updatedCount++;
                }

                // Now delete the old _O / _P record
                // @ts-ignore
                await prisma.template.delete({ where: { key: tpl.key } });
                deletedCount++;

                merges.push({ source: tpl.key, target: baseKey, type: variantType.toUpperCase() });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Merged ${deletedCount} templates into base groups.`,
            merges
        });

    } catch (error: any) {
        console.error("Merge error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
