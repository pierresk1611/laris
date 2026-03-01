import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting, updateProgress } from '@/lib/settings';
import Groq from "groq-sdk";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const urlParams = new URL(req.url);
        const action = urlParams.searchParams.get('action');

        if (action === 'list') {
            // UI Fetch Handler
            const products = await prisma.webProduct.findMany({
                include: {
                    template: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
            return NextResponse.json({ success: true, products });
        }

        // --- PAIRING ENGINE ---
        await updateProgress('AI_MATCH_PROGRESS', 0, 100, `Spúšťam Smart Match Engine...`);

        // Get unmapped products
        const unmappedProducts = await prisma.webProduct.findMany({
            where: { templateId: null }
        });

        if (unmappedProducts.length === 0) {
            await updateProgress('AI_MATCH_PROGRESS', 100, 100, `Všetky produkty sú už spárované so šablónami.`, 'COMPLETED');
            return NextResponse.json({ success: true, message: 'All products are mapped', mapped: 0 });
        }

        const templates = await prisma.template.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, key: true, sku: true, name: true, displayName: true }
        });

        let exactMatches = 0;
        let semanticMatches = 0;

        // PRIORITY 1: EXACT SKU / KEY MATCH
        await updateProgress('AI_MATCH_PROGRESS', 10, 100, `Priorita 1: Hľadám presnú zhodu (SKU)...`);

        const remainingToAI = [];

        for (const product of unmappedProducts) {
            let matchedTemplate = null;

            if (product.sku) {
                // Try to find template by explicit SKU
                matchedTemplate = templates.find(t => t.sku === product.sku);
            }

            if (!matchedTemplate && product.sku) {
                // Try to fallback to finding by Key if SKU acts as key
                matchedTemplate = templates.find(t => t.key.toLowerCase() === product.sku?.toLowerCase());
            }

            if (matchedTemplate) {
                await prisma.webProduct.update({
                    where: { id: product.id },
                    data: {
                        templateId: matchedTemplate.id,
                        matchConfidence: 1.0 // Exact Match
                    }
                });
                exactMatches++;
            } else {
                remainingToAI.push(product);
            }
        }

        // PRIORITY 2: SEMANTIC MATCH VIA GROQ
        if (remainingToAI.length > 0) {
            await updateProgress('AI_MATCH_PROGRESS', 30, 100, `Priorita 2: Semantic Match cez Groq (${remainingToAI.length} produktov)...`);

            const apiKey = await getSetting('GROQ_API_KEY');
            if (apiKey) {
                const groq = new Groq({ apiKey });

                // We batch them (e.g. 50 at a time) to not exceed token limits
                const BATCH_SIZE = 50;
                for (let i = 0; i < remainingToAI.length; i += BATCH_SIZE) {
                    const batch = remainingToAI.slice(i, i + BATCH_SIZE);
                    const progressVal = 30 + Math.floor((i / remainingToAI.length) * 60);

                    await updateProgress('AI_MATCH_PROGRESS', progressVal, 100, `Groq Analyzuje dávku ${i + 1}-${i + batch.length}...`);

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
                        const aiResponse = await groq.chat.completions.create({
                            messages: [{ role: 'user', content: prompt }],
                            model: "llama-3.3-70b-versatile",
                            temperature: 0.1,
                            response_format: { type: "json_object" }
                        });

                        const content = aiResponse.choices[0]?.message?.content || "{}";
                        const result = JSON.parse(content);

                        if (result.matches && Array.isArray(result.matches)) {
                            for (const match of result.matches) {
                                if (match.templateId && match.confidence > 0.4) {
                                    await prisma.webProduct.update({
                                        where: { id: match.productId },
                                        data: {
                                            templateId: match.templateId,
                                            matchConfidence: match.confidence
                                        }
                                    });
                                    semanticMatches++;
                                }
                            }
                        }

                    } catch (aiErr) {
                        console.error("[MatchProducts] Groq batch error", aiErr);
                    }
                }
            } else {
                console.warn("[MatchProducts] GROQ_API_KEY chýba, sémantické párovanie preskočené.");
            }
        }

        await updateProgress('AI_MATCH_PROGRESS', 100, 100, `Párovanie dokončené. (Presných: ${exactMatches}, AI: ${semanticMatches})`, 'COMPLETED');

        return NextResponse.json({
            success: true,
            exactMatches,
            semanticMatches,
            totalMapped: exactMatches + semanticMatches
        });

    } catch (error: any) {
        console.error("[MatchProducts] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
