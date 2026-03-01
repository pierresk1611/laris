import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Groq from 'groq-sdk';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const AVAILABLE_META_FIELDS = [
    'NAME_MAIN',
    'DATE_MAIN',
    'TIME_MAIN',
    'PLACE_MAIN',
    'BODY_FULL',
    'QUOTE_TOP',
    'QUOTE_BOTTOM',
    'INVITE_TEXT',
    'FOOTER_TEXT'
];

export async function POST(req: Request) {
    const encoder = new TextEncoder();
    const apiKey = await getSetting('GROQ_API_KEY');

    if (!apiKey) {
        return NextResponse.json({ success: false, error: 'AI kľúč nie je nastavený' }, { status: 500 });
    }

    const groq = new Groq({ apiKey });

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                // 1. Fetch all templates that are NOT active
                const templates = await prisma.template.findMany({
                    where: {
                        status: { not: 'ACTIVE' }
                    },
                    include: {
                        files: true
                    }
                });

                send({ type: 'START', total: templates.length });

                let processedCount = 0;
                for (const template of templates) {
                    try {
                        send({ type: 'PROGRESS', current: processedCount + 1, total: templates.length, name: template.key });

                        // Process MAIN file (or all files)
                        const mainFile = template.files.find(f => f.type === 'MAIN') || template.files[0];
                        if (!mainFile || !mainFile.layers || !Array.isArray(mainFile.layers)) {
                            processedCount++;
                            continue;
                        }

                        const layers: any[] = mainFile.layers as any[];
                        const textLayers = layers.filter(l => l.type === 'TEXT');

                        if (textLayers.length === 0) {
                            processedCount++;
                            continue;
                        }

                        const systemPrompt = `Si expertný asistent pre pred-tlačovú prípravu. Priraď názvy vrstiev k systémovým meta-poliam.
Dostupné polia: ${AVAILABLE_META_FIELDS.join(", ")}
Vrstvy: ${textLayers.map(l => l.name).join(", ")}
Odpovedaj LEN VALIDNÝM JSONOM: { "Názov vrstvy": "META_POLE" }`;

                        const completion = await groq.chat.completions.create({
                            messages: [{ role: "system", content: systemPrompt }],
                            model: "llama-3.3-70b-versatile",
                            temperature: 0.1,
                            response_format: { type: "json_object" }
                        });

                        const parsedMapping = JSON.parse(completion.choices[0]?.message?.content || '{}');

                        // Sanitize
                        const finalMapping: Record<string, string> = {};
                        for (const layer of textLayers) {
                            const mappedField = parsedMapping[layer.name];
                            if (mappedField && AVAILABLE_META_FIELDS.includes(mappedField)) {
                                finalMapping[layer.name] = mappedField;
                            }
                        }

                        const mappedCount = Object.keys(finalMapping).length;
                        const newStatus = (mappedCount >= textLayers.length) ? 'ACTIVE' : (mappedCount > 0 ? 'NEEDS_REVIEW' : 'PENDING_MAPPING');

                        // Update DB
                        await prisma.templateFile.update({
                            where: { id: mainFile.id },
                            data: { mapping: finalMapping }
                        });

                        await prisma.template.update({
                            where: { id: template.id },
                            data: {
                                mappingData: finalMapping as any,
                                mappedPaths: mappedCount,
                                status: newStatus
                            }
                        });

                    } catch (err: any) {
                        console.error(`Error processing ${template.key}:`, err);
                    } finally {
                        processedCount++;
                    }
                }

                send({ type: 'DONE', count: processedCount });
                controller.close();

            } catch (error: any) {
                send({ type: 'ERROR', error: error.message });
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
