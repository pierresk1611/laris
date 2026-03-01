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

                // PRIORITY 1: EXACT SKU / KEY MATCH
                await updateProgress('AI_MATCH_PROGRESS', 10, 100, `Priorita 1: Hľadám presnú zhodu (SKU)...`);
                sendEvent({ type: 'progress', message: 'Priorita 1: Hľadám presnú zhodu (SKU)...', percentage: 10 });

                const remainingToAI = [];

                for (let i = 0; i < unmappedProducts.length; i++) {
                    const product = unmappedProducts[i];
                    let matchedTemplate = null;

                    if (product.sku) {
                        matchedTemplate = templates.find(t => t.sku === product.sku);
                    }
                    if (!matchedTemplate && product.sku) {
                        matchedTemplate = templates.find(t => t.key.toLowerCase() === product.sku?.toLowerCase());
                    }

                    if (matchedTemplate) {
                        const updated = await prisma.webProduct.update({
                            where: { id: product.id },
                            data: {
                                templateId: matchedTemplate.id,
                                matchConfidence: 1.0
                            },
                            include: { template: true }
                        });
                        exactMatches++;
                        sendEvent({ type: 'match', product: updated });
                    } else {
                        remainingToAI.push(product);
                    }
                }

                // PRIORITY 2: SEMANTIC MATCH VIA GROQ
                if (remainingToAI.length > 0) {
                    await updateProgress('AI_MATCH_PROGRESS', 30, 100, `Priorita 2: Semantic Match cez Groq (${remainingToAI.length} produktov)...`);
                    sendEvent({ type: 'progress', message: `Priorita 2: Sémantické párovanie (${remainingToAI.length})...`, percentage: 30 });

                    const apiKey = await getSetting('GROQ_API_KEY');
                    if (apiKey) {
                        const groq = new Groq({ apiKey });

                        const BATCH_SIZE = 50;
                        for (let i = 0; i < remainingToAI.length; i += BATCH_SIZE) {
                            const batch = remainingToAI.slice(i, i + BATCH_SIZE);
                            const progressVal = 30 + Math.floor((i / remainingToAI.length) * 60);

                            const msg = `Groq Analyzuje dávku ${i + 1}-${i + batch.length}...`;
                            await updateProgress('AI_MATCH_PROGRESS', progressVal, 100, msg);
                            sendEvent({ type: 'progress', message: msg, percentage: progressVal });

                            const prompt = `
                            Si Smart Match Engine pre tlačiareň (SK/CZ eshop).
                            Máš dva zoznamy: Zoznam E-shop Produktov a zoznam existujúcich Grafických Šablón.
                            Tvojou úlohou je pre každý E-shop produkt nájsť najvhodnejšiu Šablónu podľa významu, nálady a tém.
                            Napríklad "Narodeninová pozvánka Sweet 16" by mala patriť k šablóne "16_narodeniny" alebo "sweet_16_rosa".
                            
                            ZOZNAM ŠABLÓN (Dostupné možnosti ID a Názvov):
                            ${templates.map(t => `ID: ${t.id} | Názov: ${t.displayName || t.name} | Kód: ${t.key}`).join('\n')}
                            
                            ZOZNAM PRODUKTOV NA SPÁROVANIE:
                            ${batch.map(p => `ID: ${p.id} | Názov Produktu: ${p.title}`).join('\n')}
                            
                            Odovzdaj VÝHRADNE JSON vo formáte:
                            {
                                "matches": [
                                    { 
                                        "productId": "ID z produktov",
                                        "templateId": "ID vybranej šablóny alebo null ak neexistuje dobrá zhoda",
                                        "confidence": 0.85 // odhadovaná istota (0.0 až 0.99)
                                    }
                                ]
                            }
                            Nevracaj žiadny iný text okrem čistého JSON.
                            `;

                            try {
                                let aiResponse;
                                try {
                                    aiResponse = await groq.chat.completions.create({
                                        messages: [{ role: 'user', content: prompt }],
                                        model: "llama-3.3-70b-versatile",
                                        temperature: 0.1,
                                        response_format: { type: "json_object" }
                                    });
                                } catch (primaryErr: any) {
                                    const errorMessage = primaryErr?.message?.toLowerCase() || '';
                                    if (primaryErr?.status === 429 || primaryErr?.error?.error?.code === 'rate_limit_exceeded' || errorMessage.includes('rate limit') || errorMessage.includes('429')) {
                                        console.warn(`[MatchProducts] Rate limit hit for 70b-versatile. Falling back to 8b-instant.`);
                                        aiResponse = await groq.chat.completions.create({
                                            messages: [{ role: 'user', content: prompt }],
                                            model: "llama-3.1-8b-instant",
                                            temperature: 0.1,
                                            response_format: { type: "json_object" }
                                        });
                                    } else {
                                        throw primaryErr;
                                    }
                                }

                                const content = aiResponse.choices[0]?.message?.content || "{}";
                                const result = JSON.parse(content);

                                if (result.matches && Array.isArray(result.matches)) {
                                    for (const match of result.matches) {
                                        if (match.templateId && match.confidence > 0.4) {
                                            const updated = await prisma.webProduct.update({
                                                where: { id: match.productId },
                                                data: {
                                                    templateId: match.templateId,
                                                    matchConfidence: match.confidence
                                                },
                                                include: { template: { include: { files: { where: { type: 'MAIN' } } } } }
                                            });
                                            semanticMatches++;
                                            sendEvent({ type: 'match', product: updated });
                                        }
                                    }
                                }

                            } catch (aiErr: any) {
                                console.error("[MatchProducts] Groq batch error", aiErr);
                                sendEvent({ type: 'error', message: `Umelá inteligencia zlyhala pri dávke: ${aiErr.message}` });
                            }
                        }
                    } else {
                        console.warn("[MatchProducts] GROQ_API_KEY chýba, sémantické párovanie preskočené.");
                        sendEvent({ type: 'error', message: `Chýba Groq API kľúč, sémantické párovanie preskočené.` });
                    }
                }

                await updateProgress('AI_MATCH_PROGRESS', 100, 100, `Párovanie dokončené. (Presných: ${exactMatches}, AI: ${semanticMatches})`, 'COMPLETED');
                sendEvent({ type: 'progress', message: `Hotovo! Presných: ${exactMatches}, AI nájdených: ${semanticMatches}`, percentage: 100 });
                sendEvent({ type: 'done', exactMatches, semanticMatches, totalMapped: exactMatches + semanticMatches });

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
