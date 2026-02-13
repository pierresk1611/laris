import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import mammoth from "mammoth";
import Groq from "groq-sdk";

import { getSetting } from "@/lib/settings";

export async function POST(req: NextRequest) {
    const correlationId = Math.random().toString(36).substring(7);
    try {
        const dbKey = await getSetting('GROQ_API_KEY');
        const envKey = process.env.GROQ_API_KEY;

        let groqApiKey = dbKey || envKey;
        const source = dbKey ? "DATABASE" : (envKey ? "PROCESS_ENV" : "NONE");

        console.log(`[AIParseFile:${correlationId}] Key source: ${source}`);

        if (groqApiKey?.startsWith("DECRYPTION_ERROR:")) {
            console.error(`[AIParseFile:${correlationId}] ${groqApiKey}`);
            return NextResponse.json({
                success: false,
                error: "Chyba dešifrovania kľúča v databáze. Skontrolujte ENCRYPTION_SECRET.",
                details: groqApiKey
            }, { status: 500 });
        }

        const keyPrefix = groqApiKey ? groqApiKey.substring(0, 5) : "NONE";
        console.log(`[AIParseFile:${correlationId}] Retrieved API key (length: ${groqApiKey?.length || 0}, prefix: ${keyPrefix}...)`);

        if (!groqApiKey) {
            console.error(`[AIParseFile:${correlationId}] GROQ_API_KEY missing from both DB and process.env`);
            return NextResponse.json({
                success: false,
                error: "GROQ_API_KEY nie je nakonfigurovaný. Pridajte ho v Nastaveniach."
            }, { status: 500 });
        }

        const groq = new Groq({ apiKey: groqApiKey });
        const body = await req.json();
        const { fileUrl, fileName } = body;

        if (!fileUrl) {
            return NextResponse.json({ success: false, error: "Missing file URL" }, { status: 400 });
        }

        const ext = fileName?.split('.').pop()?.toLowerCase() || "";
        let rawText = "";

        console.log(`[AIParseFile:${correlationId}] Downloading file from: ${fileUrl}`);
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        if (ext === 'docx') {
            const result = await mammoth.extractRawText({ buffer });
            rawText = result.value;
        } else {
            rawText = buffer.toString('utf-8');
        }

        if (!rawText || rawText.length < 5) {
            console.warn(`[AIParseFile:${correlationId}] Extraction resulted in very short text (${rawText.length} chars)`);
            return NextResponse.json({ success: false, error: "Nepodarilo sa vytiahnuť text zo súboru." }, { status: 400 });
        }

        console.log(`[AIParseFile:${correlationId}] Text extracted (${rawText.length} chars). Sending to AI...`);

        const systemPrompt = `Analyze the following raw text extracted from a customer's document. 
Identify and extract a list of names (wedding guests). Format the names nicely (One per line).

Return ONLY a clean JSON object with a key "names" which is a string (all names separated by newlines).
Do not include any prose or explanation.

---
EXTRACTED TEXT:
${rawText.substring(0, 10000)}`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: "You are a specialized name list extractor. Output JSON." }, { role: "user", content: systemPrompt }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
        });

        const rawResult = completion.choices[0].message.content || "{}";
        console.log(`[AIParseFile:${correlationId}] Result received from Groq`);
        const parsedResult = JSON.parse(rawResult);

        return NextResponse.json({
            success: true,
            data: parsedResult.names || "",
            rawLength: rawText.length
        });

    } catch (e: any) {
        console.error(`[AIParseFile:${correlationId}] CRITICAL ERROR:`, e.stack || e.message);
        return NextResponse.json({
            success: false,
            error: `File AI Error: ${e.message}`,
            details: e.stack
        }, { status: 500 });
    }
}
