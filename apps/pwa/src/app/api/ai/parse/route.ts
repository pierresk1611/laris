import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Groq from "groq-sdk";

import { getSetting } from "@/lib/settings";

export async function POST(req: NextRequest) {
    try {
        const groqApiKey = await getSetting('GROQ_API_KEY') || process.env.GROQ_API_KEY;
        const keyPrefix = groqApiKey ? groqApiKey.substring(0, 5) : "NONE";
        console.log(`AI Parse: retrieved API key (length: ${groqApiKey?.length || 0}, prefix: ${keyPrefix}...)`);

        if (!groqApiKey || groqApiKey === "Decryption Error") {
            console.error("AI Parse: GROQ_API_KEY missing or decryption failed");
            return NextResponse.json({
                success: false,
                error: groqApiKey === "Decryption Error"
                    ? "Chyba dešifrovania kľúča. Skontrolujte ENCRYPTION_SECRET."
                    : "GROQ_API_KEY is not configured. Please add it to Settings."
            }, { status: 500 });
        }

        const groq = new Groq({ apiKey: groqApiKey });
        const body = await req.json();
        const { text, options } = body;

        if (!text && !options) {
            return NextResponse.json({ success: false, error: "Missing data to parse" }, { status: 400 });
        }


        // Format the input for AI
        // If we have options (EPO), we use them. Otherwise we use the raw text.
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
4. If dimension information (like 10x10 cm) is found, ignore it for fields but use it to ensure context.
5. Return ONLY a valid JSON object with keys: "names", "date", "location". 
Do not include any prose or explanation.`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: "You are a helpful assistant that outputs JSON." }, { role: "user", content: systemPrompt }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
        });

        const rawResult = completion.choices[0].message.content || "{}";
        console.log("AI Parse: Result received from Groq");
        const parsedResult = JSON.parse(rawResult);

        return NextResponse.json({ success: true, data: parsedResult });

    } catch (e: any) {
        console.error("Groq AI API Route Error:", e);
        return NextResponse.json({
            success: false,
            error: `AI Error: ${e.message}`,
            details: e.stack
        }, { status: 500 });
    }
}
