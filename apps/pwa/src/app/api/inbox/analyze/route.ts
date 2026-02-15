import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings';

// Function to call Groq (simulated for now if package not present, or using fetch)
async function callGroq(apiKey: string, prompt: string) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            model: "llama3-70b-8192", // Fast and good reasoning
            temperature: 0,
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) {
        throw new Error(`Groq API Error: ${response.statusText}`);
    }

    return response.json();
}

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

        // @ts-ignore
        const examples = await prisma.aiClassificationExample.findMany({
            take: 50,
            orderBy: { createdAt: 'desc' }
        });

        // 2. Construct Prompt
        const exampleText = examples.map((e: any) => `- "${e.filename}" -> ${e.category} (${e.reasoning || ''})`).join('\n');

        const filesToAnalyze = items.map((i: any) => `"${i.name}"`).join('\n');

        const prompt = `
        You are an intelligent file classifier. 
        Your task is to categorize files into one of these categories: TEMPLATE, DOCUMENT, IGNORE.
        
        Rules:
        - TEMPLATE: Design files (.psd, .ai) that look like product templates (e.g. contains codes like JSO, KSO, PNO, Year).
        - DOCUMENT: PDF or Excel files, invoices, delivery notes (dodaci list, faktura).
        - IGNORE: System files, generic images not related to products.

        Here are some examples of past classifications:
        ${exampleText}

        Now classify these new files. Return a JSON object where keys are filenames and values are objects with "category" and "reasoning".
        Files to classify:
        ${filesToAnalyze}
        `;

        // 3. Call AI
        // We do it in one batch to save tokens/time
        const aiResponse = await callGroq(apiKey, prompt);
        const content = aiResponse.choices[0].message.content;
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

    } catch (error) {
        console.error("[InboxAnalyze] Error:", error);
        return NextResponse.json({ success: false, error: 'AI Analysis failed' }, { status: 500 });
    }
}
