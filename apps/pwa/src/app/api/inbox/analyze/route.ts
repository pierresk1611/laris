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
        Odovzdáš VÝHRADNE čistý JSON objekt (bez markdown blokov \`\`\`), kde klúčom je presný názov súboru a hodnotou objekt { "category": "KATEGORIA", "reasoning": "Krátke zdôvodnenie v slovenčine" }.
        
        Pravidlá klasifikácie:
        1. TEMPLATE: Dizajnové súbory (hlavne .psd, .ai, .png, .jpg), ktoré slúžia ako šablóny produktov.
           - POZOR: Všeobecne známe kódové označenia obsahujú čísla/roky (napr. JSO 15, ad_2026_O_nazov, atď.).
           - PREFIX ZLUČOVANIE (Veľmi dôležité): Ak v zozname vidíš súbor s podobným názvom ale končiaci na "_metal", "_mask", "_gold" atď. (napríklad "8.ai" a "8_metal.pdf"), MUSÍŠ ten metalický pod-súbor tiež označiť ako TEMPLATE a do reasoning uviesť: "Súčasť šablóny (maska)". Patria totiž k sebe!
        2. DOCUMENT: Kancelárske súbory, PDF faktúry, dodacie listy, excel tabuľky, manuály k tlači.
        3. IGNORE: Systémové súbory (napr. .DS_Store), náhľadové mockup fotky nepatriace k produktu, úplný odpad.

        Príklady z minulosti:
        ${exampleText}

        Súbory na klasifikáciu:
        ${filesToAnalyze}
        `;

        // 3. Call AI
        const aiResponse = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: "llama3-70b-8192", // Fast and good reasoning
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
