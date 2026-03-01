import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: any) => {
                controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
            };

            try {
                // 1. Fetch all UNCLASSIFIED items
                const unclassifiedItems = await prisma.fileInbox.findMany({
                    where: { status: 'UNCLASSIFIED' }
                });

                // Filter in JS for reliability (Prisma JSON filters can be tricky across providers/versions)
                const itemsToApprove = unclassifiedItems.filter(item => {
                    const pred = item.prediction as any;
                    return pred?.category === 'TEMPLATE';
                });

                console.log(`[BulkApprove] Found ${itemsToApprove.length} templates out of ${unclassifiedItems.length} unclassified items.`);

                if (itemsToApprove.length === 0) {
                    sendEvent({ type: 'progress', message: 'Nenašli sa žiadne nové AI šablóny na schválenie.', percentage: 100 });
                    sendEvent({ type: 'done', processed: 0, errors: 0 });
                    controller.close();
                    return;
                }

                sendEvent({ type: 'progress', message: `Našlo sa ${itemsToApprove.length} šablón. Začínam spracovanie...`, percentage: 0 });

                let processedCount = 0;
                let errorCount = 0;

                for (let i = 0; i < itemsToApprove.length; i++) {
                    const inboxItem = itemsToApprove[i];
                    try {
                        const name = inboxItem.name;
                        const pathDisplay = inboxItem.path;
                        const extension = name.includes('.') ? name.substring(name.lastIndexOf('.')).toLowerCase() : '';
                        const nameWithoutExt = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;

                        // Extract SKU
                        const skuMatch = nameWithoutExt.match(/SKU[:_]\s*([a-zA-Z0-9_-]+)/i);
                        const extractedSku = skuMatch ? skuMatch[1].trim() : null;

                        // Clean name
                        const cleanName = nameWithoutExt.replace(/SKU[:_]\s*[a-zA-Z0-9_-]+/i, '').trim();

                        // Variant detection (Logic mirrored from bulk-classify)
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

                        const finalKey = extractedSku || potentialKey;

                        const existingTemplate = await prisma.template.findUnique({
                            where: { key: finalKey }
                        }) as any;

                        if (existingTemplate) {
                            await prisma.template.update({
                                where: { id: existingTemplate.id },
                                data: {
                                    imageUrl: existingTemplate.imageUrl || inboxItem.thumbnailData || null,
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
                                    imageUrl: inboxItem.thumbnailData || null
                                },
                                create: {
                                    templateId: existingTemplate.id,
                                    type: variantType,
                                    path: pathDisplay,
                                    extension: extension,
                                    imageUrl: inboxItem.thumbnailData || null
                                }
                            });

                            // Legacy sync for backward compatibility
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
                                    status: 'ACTIVE',
                                    isVerified: false,
                                    imageUrl: inboxItem.thumbnailData || null,
                                    variants: [{ key: nameWithoutExt, type: variantType, path: pathDisplay, extension, mapping: {} }] as any
                                }
                            });

                            await prisma.templateFile.create({
                                data: {
                                    templateId: newTemplate.id,
                                    type: variantType,
                                    path: pathDisplay,
                                    extension: extension,
                                    imageUrl: inboxItem.thumbnailData || null
                                }
                            });
                        }

                        // Mark as processed in Inbox
                        await prisma.fileInbox.update({
                            where: { id: inboxItem.id },
                            data: { status: 'PROCESSED' }
                        });

                        processedCount++;
                    } catch (err) {
                        console.error(`[BulkApprove] Error for ${inboxItem.name}:`, err);
                        errorCount++;
                    }

                    // Send progress update
                    const percentage = Math.round(((i + 1) / itemsToApprove.length) * 100);
                    sendEvent({
                        type: 'progress',
                        message: `Spracovávam ${i + 1} z ${itemsToApprove.length}: ${inboxItem.name}`,
                        percentage
                    });
                }

                sendEvent({ type: 'done', processed: processedCount, errors: errorCount });
                controller.close();

            } catch (error: any) {
                console.error("[BulkApprove] Fatal:", error);
                sendEvent({ type: 'error', message: error.message });
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
