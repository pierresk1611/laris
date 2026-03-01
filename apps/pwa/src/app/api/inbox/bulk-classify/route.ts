import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { ids, action } = await req.json(); // action: 'TEMPLATE', 'DOCUMENT', 'IGNORE'

        if (!ids || !Array.isArray(ids) || !action) {
            return NextResponse.json({ success: false, error: 'Missing ids or action' }, { status: 400 });
        }

        console.log(`[BulkClassify] Starting process for ${ids.length} items with action: ${action}`);

        let processedCount = 0;
        let errorCount = 0;

        for (const id of ids) {
            try {
                // @ts-ignore
                const inboxItem = await prisma.fileInbox.findUnique({ where: { id } });
                if (!inboxItem) {
                    console.warn(`[BulkClassify] Item ${id} not found, skipping.`);
                    errorCount++;
                    continue;
                }

                if (action === 'TEMPLATE') {
                    const name = inboxItem.name;
                    const pathDisplay = inboxItem.path;
                    const extension = name.includes('.') ? name.substring(name.lastIndexOf('.')).toLowerCase() : '';
                    const nameWithoutExt = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;

                    // Extract SKU
                    const skuMatch = nameWithoutExt.match(/SKU[:_]\s*([a-zA-Z0-9_-]+)/i);
                    const extractedSku = skuMatch ? skuMatch[1].trim() : null;

                    // Clean name
                    const cleanName = nameWithoutExt.replace(/SKU[:_]\s*[a-zA-Z0-9_-]+/i, '').trim();

                    // Variant detection
                    const v2Match = cleanName.match(/^ad_(.*?)_([OP])_(.*)$/i);
                    const oldMatch = cleanName.match(/^(.*?)_([OP])$/i);
                    const spaceMatch = cleanName.match(/^(.*?)\s+([OP])$/i);
                    const aggressiveMatch = cleanName.match(/^([A-Z0-9_-]+?)([OP])$/i);

                    let potentialKey = cleanName.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
                    let variantType = 'MAIN';

                    if (v2Match) {
                        potentialKey = v2Match[1].toUpperCase();
                        variantType = v2Match[2].toUpperCase() === 'P' ? 'INVITE' : 'MAIN';
                    } else if (oldMatch) {
                        potentialKey = oldMatch[1].replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
                        variantType = oldMatch[2].toUpperCase() === 'P' ? 'INVITE' : 'MAIN';
                    } else if (spaceMatch) {
                        potentialKey = spaceMatch[1].replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
                        variantType = spaceMatch[2].toUpperCase() === 'P' ? 'INVITE' : 'MAIN';
                    } else if (aggressiveMatch && !cleanName.includes('_') && !cleanName.includes(' ')) {
                        potentialKey = aggressiveMatch[1].toUpperCase();
                        variantType = aggressiveMatch[2].toUpperCase() === 'P' ? 'INVITE' : 'MAIN';
                    } else if (cleanName.toUpperCase().endsWith('_P') || cleanName.toUpperCase().endsWith(' P')) {
                        variantType = 'INVITE';
                        potentialKey = cleanName.substring(0, cleanName.length - 2).replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
                    }

                    const finalKey = extractedSku || potentialKey;

                    const existingTemplate = await prisma.template.findUnique({
                        where: { key: finalKey }
                    }) as any;

                    if (existingTemplate) {
                        await prisma.template.update({
                            where: { id: existingTemplate.id },
                            data: {
                                imageUrl: existingTemplate.imageUrl || (inboxItem as any).thumbnailData || null,
                                sku: existingTemplate.sku || extractedSku,
                                displayName: existingTemplate.displayName || cleanName.replace(/_/g, ' ')
                            }
                        });

                        await prisma.templateFile.upsert({
                            where: {
                                templateId_type: { templateId: existingTemplate.id, type: variantType }
                            },
                            update: {
                                path: pathDisplay,
                                extension: extension,
                                imageUrl: (inboxItem as any).thumbnailData || null
                            },
                            create: {
                                templateId: existingTemplate.id,
                                type: variantType,
                                path: pathDisplay,
                                extension: extension,
                                imageUrl: (inboxItem as any).thumbnailData || null
                            }
                        });

                        // Legacy sync
                        const existingVariants = Array.isArray(existingTemplate.variants) ? [...(existingTemplate.variants as any[])] : [];
                        const vIndex = existingVariants.findIndex((v: any) => v.type === variantType);
                        if (vIndex !== -1) {
                            existingVariants[vIndex] = { ...existingVariants[vIndex], key: nameWithoutExt, path: pathDisplay, extension };
                        } else {
                            existingVariants.push({ key: nameWithoutExt, type: variantType, path: pathDisplay, extension, mapping: {} });
                        }
                        await prisma.template.update({
                            where: { id: existingTemplate.id },
                            data: { variants: existingVariants as any }
                        });
                    } else {
                        const newTemplate = await prisma.template.create({
                            data: {
                                key: finalKey,
                                name: cleanName.replace(/_/g, ' '),
                                displayName: cleanName.replace(/_/g, ' '),
                                sku: extractedSku,
                                status: 'NEEDS_REVIEW',
                                isVerified: false,
                                imageUrl: (inboxItem as any).thumbnailData || null,
                                variants: [{ key: nameWithoutExt, type: variantType, path: pathDisplay, extension, mapping: {} }] as any
                            }
                        });

                        await prisma.templateFile.create({
                            data: {
                                templateId: newTemplate.id,
                                type: variantType,
                                path: pathDisplay,
                                extension: extension,
                                imageUrl: (inboxItem as any).thumbnailData || null
                            }
                        });
                    }
                }

                // Status Update
                const newStatus = action === 'IGNORE' ? 'IGNORED' : 'PROCESSED';
                // @ts-ignore
                await prisma.fileInbox.update({
                    where: { id },
                    data: { status: newStatus }
                });

                // Learning Example
                // @ts-ignore
                const existingExample = await prisma.aiClassificationExample.findFirst({
                    where: { filename: inboxItem.name }
                });
                if (!existingExample) {
                    // @ts-ignore
                    await prisma.aiClassificationExample.create({
                        data: {
                            filename: inboxItem.name,
                            category: action,
                            reasoning: 'User Bulk Action'
                        }
                    });
                }

                processedCount++;
            } catch (itemError) {
                console.error(`[BulkClassify] Error processing item ${id}:`, itemError);
                errorCount++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Spracovaných ${processedCount} súborov, chyby: ${errorCount}.`,
            count: processedCount,
            errors: errorCount
        });

    } catch (error) {
        console.error("[BulkClassify] CRITICAL Error:", error);
        return NextResponse.json({ success: false, error: 'Bulk classification failed' }, { status: 500 });
    }
}
