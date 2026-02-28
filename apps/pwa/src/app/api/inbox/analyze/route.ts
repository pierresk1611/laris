import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings';
import Groq from "groq-sdk";

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

        // 2. Construct Prompt
        const exampleText = examples.map((e: any) => `- "${e.filename}" -> ${e.category} (${e.reasoning || ''})`).join('\n');

        const filesToAnalyze = items.map((i: any) => `"${i.name}"`).join('\n');

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
        const predictions = JSON.parse(content);

        // 4. Save predictions to DB (update FileInbox items)
        const updates = [];
        for (const item of items) {
            const pred = predictions[item.name];
            if (pred) {
                // @ts-ignore
                const update = prisma.fileInbox.update({
                    where: { id: item.id },
                    data: {
                        prediction: pred
                    }
                });
                updates.push(update);
            }
        }

        await prisma.$transaction(updates);

        return NextResponse.json({ success: true, predictions });

    } catch (error: any) {
        console.error("[InboxAnalyze] Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message || 'AI Analysis failed'
        }, { status: 500 });
    }
}
