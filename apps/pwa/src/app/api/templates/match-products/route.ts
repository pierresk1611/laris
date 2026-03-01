import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting, updateProgress } from '@/lib/settings';
import Groq from "groq-sdk";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const urlParams = new URL(req.url);
        const action = urlParams.searchParams.get('action');

        if (action === 'list') {
            const products = await prisma.webProduct.findMany({
                include: {
                    template: {
                        include: {
                            files: {
                                where: { type: 'MAIN' }
                            }
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
            return NextResponse.json({ success: true, products });
        }
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        console.error("[MatchProducts GET] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: any) => {
                controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
            };

            try {
                // --- PAIRING ENGINE ---
                await updateProgress('AI_MATCH_PROGRESS', 0, 100, `Spúšťam Smart Match Engine...`);
                sendEvent({ type: 'progress', message: 'Spúšťam Smart Match Engine...', percentage: 0 });

                // Get unmapped products
                const unmappedProducts = await prisma.webProduct.findMany({
                    where: { templateId: null }
                });

                if (unmappedProducts.length === 0) {
                    await updateProgress('AI_MATCH_PROGRESS', 100, 100, `Všetky produkty sú už spárované so šablónami.`, 'COMPLETED');
                    sendEvent({ type: 'progress', message: 'Všetky produkty sú už spárované.', percentage: 100 });
                    sendEvent({ type: 'done', exactMatches: 0, semanticMatches: 0, mapped: 0 });
                    controller.close();
                    return;
                }

                const templates = await prisma.template.findMany({
                    where: { status: 'ACTIVE' },
                    select: { id: true, key: true, sku: true, name: true, displayName: true }
                });

                let exactMatches = 0;
                let semanticMatches = 0;

                // PRIORITY 1: EXACT SKU / KEY / TITLE SEARCH
                await updateProgress('AI_MATCH_PROGRESS', 10, 100, `Priorita 1: Hľadám presnú zhodu (SKU/Názov)...`);
                sendEvent({ type: 'progress', message: 'Priorita 1: Hľadám presnú zhodu (SKU/Názov)...', percentage: 10 });

                const remainingToAI = [];

                // Sort templates by key length (descending) to match longer keys first (e.g., "JSO 15" before "JSO")
                const sortedTemplates = [...templates].sort((a, b) => b.key.length - a.key.length);

                for (let i = 0; i < unmappedProducts.length; i++) {
                    const product = unmappedProducts[i];
                    let matchedTemplate = null;

                    // 1. Check direct SKU match
                    if (product.sku) {
                        matchedTemplate = templates.find(t => t.sku === product.sku);
                    }

                    // 2. Check SKU as Template Key match
                    if (!matchedTemplate && product.sku) {
                        matchedTemplate = templates.find(t => t.key.toLowerCase() === product.sku?.toLowerCase());
                    }

                    if (matchedTemplate) {
                        const updated = await prisma.webProduct.update({
                            where: { id: product.id },
                            data: {
                                templateId: matchedTemplate.id,
                                matchConfidence: 1.0 // Verified
                            },
                            include: {
                                template: {
                                    include: {
                                        files: { where: { type: 'MAIN' } }
                                    }
                                }
                            }
                        });
                        exactMatches++;
                        sendEvent({ type: 'match', product: updated });
                    } else {
                        remainingToAI.push(product);
                    }
                }

                // RULE 2 has been completely removed to enforce 100% strict matching.
                // Products that did not match by exact SKU/Key in Priority 1 will simply remain unmapped (NENAPÁROVANÉ)
                // and must be linked manually by the operator via the Searchable Select UI.

                // Send progress update based only on exact matches
                await updateProgress('AI_MATCH_PROGRESS', 100, 100, `Párovanie dokončené. (Overené: ${exactMatches}, Nenapárované: ${remainingToAI.length})`, 'COMPLETED');
                sendEvent({ type: 'progress', message: `Hotovo! Overené: ${exactMatches}, Nenapárované: ${remainingToAI.length}`, percentage: 100 });
                sendEvent({ type: 'done', exactMatches, semanticMatches: 0, totalMapped: exactMatches });

                controller.close();
            } catch (error: any) {
                console.error("[MatchProducts] Error:", error);
                sendEvent({ type: 'error', message: error.message });
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
