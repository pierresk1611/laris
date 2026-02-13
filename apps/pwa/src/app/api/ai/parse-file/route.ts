import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import mammoth from "mammoth";
import Groq from "groq-sdk";

import { getSetting } from "@/lib/settings";

export async function POST(req: NextRequest) {
    try {
        const groqApiKey = await getSetting('GROQ_API_KEY') || process.env.GROQ_API_KEY;

        if (!groqApiKey) {
            return NextResponse.json({
                success: false,
                error: "GROQ_API_KEY is not configured in Settings"
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

        // 1. Download and Parse File
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        if (ext === 'docx') {
            const result = await mammoth.extractRawText({ buffer });
            rawText = result.value;
        } else if (ext === 'txt' || ext === 'csv') {
            rawText = buffer.toString('utf-8');
        } else {
            // Try to treat as text if extension unknown
            rawText = buffer.toString('utf-8');
        }

        if (!rawText || rawText.length < 5) {
            return NextResponse.json({ success: false, error: "Could not extract text from file" }, { status: 400 });
        }

        // 2. Send to Groq AI
        const systemPrompt = `Analyze the following raw text extracted from a customer's document. 
Identify and extract a list of names (e.g., wedding guest names for place cards). 
Format the names nicely (One per line).

Return ONLY a clean JSON object with a key "names" which is a string (all names separated by newlines).
Do not include any prose or explanation.

---
EXTRACTED TEXT:
${rawText.substring(0, 10000)} // Limit to 10k chars for sanity
`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: "You are a specialized name list extractor. Output JSON." }, { role: "user", content: systemPrompt }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
        });

        const rawResult = completion.choices[0].message.content || "{}";
        const parsedResult = JSON.parse(rawResult);

        return NextResponse.json({
            success: true,
            data: parsedResult.names || "",
            rawLength: rawText.length
        });

    } catch (e: any) {
        console.error("File Parse Error:", e);
        return NextResponse.json({
            success: false,
            error: "Failed to process file",
            details: e.message
        }, { status: 500 });
    }
}
