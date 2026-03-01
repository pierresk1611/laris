import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings';
import Groq from "groq-sdk";

export const maxDuration = 60; // Up to 60s for serverless execution

export async function POST(req: Request) {
    try {
        const { items } = await req.json(); // List of FileInbox items

        if (!items || !items.length) {
            return NextResponse.json({ success: true, predictions: [] });
        }

        // 1. Fetch training examples and Groq Key
        const apiKey = await getSetting('GROQ_API_KEY');
        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'GROQ_API_KEY missing' });
        }

        const groq = new Groq({ apiKey });

        // @ts-ignore
        const examples = await prisma.aiClassificationExample.findMany({
            take: 50,
            orderBy: { createdAt: 'desc' }
        });

        const exampleText = examples.map((e: any) => `- "${e.filename}" -> ${e.category} (${e.reasoning || ''})`).join('\n');

        // 2. Process in batches to avoid timeout and token limits
        const BATCH_SIZE = 50;
        const predictions: any = {};

        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            const filesToAnalyze = batch.map((item: any) => `"${item.name}"`).join('\n');

            const prompt = `
            Si inteligentný klasifikátor grafických súborov pre tlačiareň. Tvojou úlohou je roztriediť zoznam súborov do 3 kategórií: TEMPLATE, DOCUMENT, IGNORE.
            Navyše musíš identifikovať súbory, ktoré k sebe patria (napr. PSD predloha a jej PNG náhľad).

            Odovzdáš VÝHRADNE čistý JSON objekt (bez markdown blokov \`\`\`), kde klúčom je presný názov súboru a hodnotou objekt:
            { 
              "category": "KATEGORIA", 
              "reasoning": "Zdôvodnenie",
              "group_id": "Spoločný identifikátor pre súvisiace súbory (napr. SKU alebo kmeň názvu)"
            }
            
            Pravidlá klasifikácie:
            1. TEMPLATE: Dizajnové súbory (.psd, .ai, .psdt, .png, .jpg), ktoré slúžia ako šablóny produktov.
               - Ak vidíš "Pozvanka na...", je to TEMPLATE.
               - Súbory so spoločným kódom v názve (napr. 2025_41) označi rovnakým "group_id".
            2. DOCUMENT: Faktúry, PDF dodacie listy, excel tabuľky, manuály.
            3. IGNORE: Systémové súbory (.DS_Store), mockup fotky.

            Príklady z minulosti:
            ${exampleText}

            Súbory na klasifikáciu:
            ${filesToAnalyze}
            `;

            // 3. Call AI
            const aiResponse = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: "llama-3.3-70b-versatile",
                temperature: 0.1,
                response_format: { type: "json_object" }
            });

            const content = aiResponse.choices[0]?.message?.content || "{}";
            try {
                Object.assign(predictions, JSON.parse(content));
            } catch (err) {
                console.warn("[InboxAnalyze] Failed to parse batch JSON", err);
            }
        }

        // 4. Save predictions to DB (update FileInbox items)
        let successCount = 0;
        for (const item of items) {
            const pred = predictions[item.name] || predictions[item.id]; // fallback
            if (pred) {
                try {
                    // @ts-ignore
                    await prisma.fileInbox.update({
                        where: { id: item.id },
                        data: {
                            prediction: pred
                        }
                    });
                    successCount++;
                } catch (updateErr) {
                    console.warn(`[InboxAnalyze] Skipping update for ${item.id} - not found or locked.`);
                }
            }
        }

        return NextResponse.json({ success: true, predictions });

    } catch (error: any) {
        console.error("[InboxAnalyze] Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message || 'AI Analysis failed'
        }, { status: 500 });
    }
}
