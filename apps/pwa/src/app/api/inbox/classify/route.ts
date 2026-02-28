import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { id, action } = await req.json(); // action: 'TEMPLATE', 'DOCUMENT', 'IGNORE'

        if (!id || !action) {
            return NextResponse.json({ success: false, error: 'Missing id or action' }, { status: 400 });
        }

        // @ts-ignore
        const inboxItem = await prisma.fileInbox.findUnique({ where: { id } });
        if (!inboxItem) {
            return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
        }

        // 1. Handle Logic based on Action
        if (action === 'TEMPLATE') {
            const name = inboxItem.name;
            const pathDisplay = inboxItem.path;
            const extension = name.includes('.') ? name.substring(name.lastIndexOf('.')) : '';
            const nameWithoutExt = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;

            // Extract SKU if present (pattern: SKU: xxx or SKU_xxx)
            let extractedSku: string | null = null;
            const skuMatch = nameWithoutExt.match(/SKU[:_]\s*([a-zA-Z0-9_-]+)/i);
            if (skuMatch) {
                extractedSku = skuMatch[1].trim();
            }

            // Clean name for key (remove SKU part)
            const cleanName = nameWithoutExt.replace(/SKU[:_]\s*[a-zA-Z0-9_-]+/i, '').trim();

            // Detect Variant Type using standard regexes
            const v2Match = cleanName.match(/^ad_(.*?)_([OP])_(.*)$/i);
            const oldMatch = cleanName.match(/^(.*?)_([OP])$/i);
            const aggressiveMatch = cleanName.match(/^([A-Z0-9_-]+?)([OP])$/i);

            let potentialKey = cleanName.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
            let variantType = 'MAIN';

            if (v2Match) {
                potentialKey = v2Match[1].toUpperCase();
                variantType = v2Match[2].toUpperCase() === 'P' ? 'INVITE' : 'MAIN';
            } else if (oldMatch) {
                potentialKey = oldMatch[1].replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
                variantType = oldMatch[2].toUpperCase() === 'P' ? 'INVITE' : 'MAIN';
            } else if (aggressiveMatch && !cleanName.includes('_')) {
                potentialKey = aggressiveMatch[1].toUpperCase();
                variantType = aggressiveMatch[2].toUpperCase() === 'P' ? 'INVITE' : 'MAIN';
            } else if (cleanName.toUpperCase().endsWith('_P')) {
                variantType = 'INVITE';
            }

            // If we have a SKU, use it as the primary key
            const finalKey = extractedSku || potentialKey;

            const existingTemplate = await prisma.template.findUnique({ where: { key: finalKey } }) as any;

            const newVariant = {
                key: nameWithoutExt,
                type: variantType,
                path: pathDisplay,
                extension: extension,
                mapping: {}
            };

            if (existingTemplate) {
                const existingVariants = Array.isArray(existingTemplate.variants) ? existingTemplate.variants : [];
                // Check if this path is already there
                if (!existingVariants.find((v: any) => v.path === pathDisplay)) {
                    existingVariants.push(newVariant);

                    await prisma.template.update({
                        where: { key: finalKey },
                        data: {
                            variants: existingVariants as any,
                            imageUrl: existingTemplate.imageUrl || (inboxItem as any).thumbnailData || null,
                            sku: existingTemplate.sku || extractedSku
                        } as any
                    });
                }
            } else {
                await prisma.template.create({
                    data: {
                        key: finalKey,
                        name: cleanName.replace(/_/g, ' '),
                        sku: extractedSku,
                        status: 'ACTIVE',
                        isVerified: false,
                        imageUrl: (inboxItem as any).thumbnailData || null,
                        variants: [newVariant] as any
                    } as any
                });
            }
        }
        else if (action === 'DOCUMENT') {
            // Future: Link to order? For now just mark processed.
        }

        // 2. Mark Inbox Item as PROCESSED or IGNORED
        const newStatus = action === 'IGNORE' ? 'IGNORED' : 'PROCESSED';
        // @ts-ignore
        await prisma.fileInbox.update({
            where: { id },
            data: { status: newStatus }
        });

        // 3. Learn! (Save to Classification Example)
        // Only if not ignored? Or maybe ignore is also a learning signal? Yes it is.
        const category = action; // TEMPLATE, DOCUMENT, IGNORE

        // Check duplication to avoid spamming examples
        // @ts-ignore
        const existingExample = await prisma.aiClassificationExample.findFirst({
            where: { filename: inboxItem.name }
        });

        if (!existingExample) {
            // @ts-ignore
            await prisma.aiClassificationExample.create({
                data: {
                    filename: inboxItem.name,
                    category: category,
                    reasoning: 'User Manual Action'
                }
            });
        }

        return NextResponse.json({ success: true, message: 'Classified successfully' });

    } catch (error) {
        console.error("[InboxClassify] Error:", error);
        return NextResponse.json({ success: false, error: 'Classification failed' }, { status: 500 });
    }
}
