import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // @ts-ignore
        const templates = await prisma.template.findMany({
            orderBy: { key: 'asc' }
        });

        // Try to attach thumbnails from inbox if missing
        // @ts-ignore
        const inboxItems = await prisma.fileInbox.findMany({
            select: { name: true, path: true, extension: true, thumbnailData: true }
        });

        const enhancedTemplates = templates.map((t: any) => {
            if (!t.imageUrl) {
                // Find matching inbox item that is likely the root template file
                const match = inboxItems.find((i: any) =>
                    i.name.includes(t.key) &&
                    ['.png', '.jpg', '.jpeg', '.ai', '.psd', '.psdt'].includes(i.extension.toLowerCase())
                );

                if (match) {
                    if (match.thumbnailData) {
                        return { ...t, imageUrl: match.thumbnailData };
                    } else {
                        return { ...t, _inboxPath: match.path, _inboxExt: match.extension };
                    }
                }
            }
            return t;
        });

        return NextResponse.json({ success: true, templates: enhancedTemplates });
    } catch (error) {
        console.error("[TemplatesAPI] Error:", error);
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { templates } = body;

        if (!Array.isArray(templates)) {
            return NextResponse.json({ success: false, error: 'Invalid data format' }, { status: 400 });
        }

        const limit = 50; // Process in chunks if needed, but for now linear is fine for reasonable counts
        let updatedCount = 0;
        let createdCount = 0;

        for (const tpl of templates) {
            // Upsert template
            // We now prefer 'sku' as the primary identifier if available, otherwise 'key'
            if (!tpl.key && !tpl.sku) continue;

            const templateKey = tpl.sku || tpl.key;

            const result = await prisma.template.upsert({
                where: { key: templateKey },
                update: {
                    name: tpl.name || templateKey,
                    sku: tpl.sku || null,
                    imageUrl: tpl.imageUrl || undefined,
                    updatedAt: new Date()
                },
                create: {
                    key: templateKey,
                    sku: tpl.sku || null,
                    name: tpl.name || templateKey,
                    status: "NEEDS_REVIEW",
                    imageUrl: tpl.imageUrl,
                    mappedPaths: 0
                }
            });

            // Handle Template Files
            if (tpl.files && Array.isArray(tpl.files)) {
                for (const file of tpl.files) {
                    await prisma.templateFile.upsert({
                        where: {
                            templateId_type: {
                                templateId: result.id,
                                type: file.type || 'MAIN'
                            }
                        },
                        update: {
                            path: file.path,
                            imageUrl: file.imageUrl || undefined
                        },
                        create: {
                            templateId: result.id,
                            type: file.type || 'MAIN',
                            path: file.path,
                            imageUrl: file.imageUrl
                        }
                    });
                }
            }

            // AUTO-PAIRING LOGIC
            if (tpl.sku) {
                const products = await prisma.webProduct.findMany({
                    where: { sku: tpl.sku }
                });

                if (products.length > 0) {
                    await prisma.webProduct.updateMany({
                        where: { sku: tpl.sku },
                        data: {
                            templateId: result.id,
                            matchConfidence: 1.0
                        }
                    });
                    console.log(`[AutoPair] Matched ${products.length} products to template ${templateKey}`);
                }
            }
        }

        return NextResponse.json({ success: true, count: templates.length });
    } catch (error) {
        console.error("[TemplatesAPI] Sync Error:", error);
        return NextResponse.json({ success: false, error: 'Sync failed' }, { status: 500 });
    }
}
