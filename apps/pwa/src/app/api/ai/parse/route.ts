import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Groq from "groq-sdk";

import { getSetting } from "@/lib/settings";

export async function POST(req: NextRequest) {
    const correlationId = Math.random().toString(36).substring(7);
    try {
        const dbKey = await getSetting('GROQ_API_KEY');
        const envKey = process.env.GROQ_API_KEY;

        let groqApiKey = dbKey || envKey;
        const source = dbKey ? "DATABASE" : (envKey ? "PROCESS_ENV" : "NONE");

        console.log(`[AIParse:${correlationId}] Key source: ${source}`);

        if (groqApiKey?.startsWith("DECRYPTION_ERROR:")) {
            console.error(`[AIParse:${correlationId}] ${groqApiKey}`);
            return NextResponse.json({
                success: false,
                error: "Chyba dešifrovania kľúča v databáze. Skontrolujte ENCRYPTION_SECRET.",
                details: groqApiKey
            }, { status: 500 });
        }

        const keyPrefix = groqApiKey ? groqApiKey.substring(0, 5) : "NONE";
        console.log(`[AIParse:${correlationId}] Retrieved API key (length: ${groqApiKey?.length || 0}, prefix: ${keyPrefix}...)`);

        if (!groqApiKey) {
            console.error(`[AIParse:${correlationId}] GROQ_API_KEY missing from both DB and process.env`);
            return NextResponse.json({
                success: false,
                error: "GROQ_API_KEY nie je nakonfigurovaný. Pridajte ho v Nastaveniach."
            }, { status: 500 });
        }

        const groq = new Groq({ apiKey: groqApiKey });
        const body = await req.json();
        const { text, options } = body;

        if (!text && !options) {
            return NextResponse.json({ success: false, error: "Missing data to parse" }, { status: 400 });
        }


        // Format the input for AI
        let inputContent = text || "";
        if (options && typeof options === 'object') {
            inputContent = Object.entries(options)
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n");
        }

        // Fetch few-shot examples from patterns
        // @ts-ignore
        const patterns = await prisma.aiPattern.findMany({
            take: 3,
            orderBy: { createdAt: 'desc' }
        });

        const examplesPrompt = patterns.length > 0
            ? "Here are some examples of how to parse similar data:\n\n" +
            patterns.map((p: any) => `Input:\n${p.input}\nOutput:\n${JSON.stringify(p.output, null, 2)}`).join("\n\n")
            : "No examples available yet. Use your best judgment.";

        const systemPrompt = `You are a specialized parser for gift and wedding store orders. 
Your task is to extract structured information (names, date, location) from the provided order details.

${examplesPrompt}

---
DATA TO PARSE:
${inputContent}

---
INSTRUCTIONS:
1. Extract 'names' (names of the celebrated persons).
2. Extract 'date' (date and time if available).
3. Extract 'location' (where the event takes place).
4. Return ONLY a valid JSON object with keys: "names", "date", "location". 
Do not include any prose or explanation.`;

        console.log(`[AIParse:${correlationId}] Sending request to Groq SDK...`);
        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: "You are a helpful assistant that outputs JSON." }, { role: "user", content: systemPrompt }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
        });

        const rawResult = completion.choices[0].message.content || "{}";
        console.log(`[AIParse:${correlationId}] Result received from Groq`);
        const parsedResult = JSON.parse(rawResult);

        return NextResponse.json({ success: true, data: parsedResult });

    } catch (e: any) {
        console.error(`[AIParse:${correlationId}] CRITICAL ERROR:`, e.stack || e.message);
        return NextResponse.json({
            success: false,
            error: `AI Error: ${e.message}`,
            details: e.stack
        }, { status: 500 });
    }
}
