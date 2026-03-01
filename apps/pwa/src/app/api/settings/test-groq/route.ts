import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';
import Groq from "groq-sdk";

export async function POST(req: Request) {
    try {
        const apiKey = await getSetting('GROQ_API_KEY');
        if (!apiKey) {
            return NextResponse.json({ success: false, error: "Nenájdený Groq API kľúč v Databáze. Vyplňte ho a uložte." });
        }

        const groq = new Groq({ apiKey });
        const startTime = Date.now();

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: "Say simply 'Hello, System OK.'" }],
            model: "llama-3.1-8b-instant",
            max_tokens: 10,
        });

        const latencyMs = Date.now() - startTime;
        const msg = chatCompletion.choices[0]?.message?.content || "";

        return NextResponse.json({
            success: true,
            latencyMs,
            message: msg
        });

    } catch (e: any) {
        console.error("[TestGroq] Failed:", e);
        return NextResponse.json({
            success: false,
            error: e.message || "Bilinmeyen chyba pri komunikácii s Groq."
        });
    }
}
