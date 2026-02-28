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
    try {
        const body = await req.json();
        const { templateId, variantType, layers } = body;

        if (!templateId || !Array.isArray(layers)) {
            return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
        }

        const apiKey = await getSetting('GROQ_API_KEY');
        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'Groq API kľúč nie je nastavený' }, { status: 500 });
        }

        const groq = new Groq({ apiKey });

        const systemPrompt = `Si expertný asistent pre pred-tlačovú prípravu. Tvojou úlohou je priradiť názvy vrstiev z Photoshop súboru k našim pevne definovaným systémovým meta-poliam na základe ich sémantického významu a účelu pre svadobné/spoločenské oznámenia.

Dostupné systémové meta-polia:
${AVAILABLE_META_FIELDS.join(", ")}

Zoznam vrstiev z aktuálnej šablóny:
${layers.map(l => l.name).join(", ")}

PRAVIDLÁ:
1. Priraď (namapuj) len textové vrstvy, ktoré jednoznačne pasujú k meta-poľu.
2. Názvy ako "Meno", "Mená", "Jano_a_Zuzka" -> NAME_MAIN
3. Názvy ako "Datum", "24_08_2024" -> DATE_MAIN
4. Názvy ako "Cas", "15:00" -> TIME_MAIN
5. Názvy ako "Miesto", "Kostol sv. Martina" -> PLACE_MAIN
6. Názvy ako "Text Oznámenia", "Srdečne Vás pozývame" -> BODY_FULL
7. Názvy ako "Citát", "Motto" -> QUOTE_TOP alebo QUOTE_BOTTOM
8. Názvy ako "Pozvánka k stolu", "Prijmite pozvanie" -> INVITE_TEXT
9. Názvy ako "Pätička", "RSVP", "Kontakt", "FOOTER_CONTENT" -> FOOTER_TEXT
10. Ak dostaneš na namapovanie vrstvu s názvom obsahujúcim 'BG', 'BACKGROUND', 'POZADIE' alebo ide o grafický element, vráť pre ňu hodnotu 'IGNORE'. Tieto vrstvy nepotrebujeme mapovať.
11. Tvoja odpoveď MUSÍ BYŤ LEN VALIDNÝ JSON vo formáte objektu, kde klúč je presný názov vrstvy (z PSD) a hodnota je presný názov meta-poľa (alebo 'IGNORE'/null). Nepíšte žiadne komentáre ani markdown.`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: systemPrompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const jsonResponse = completion.choices[0]?.message?.content;
        if (!jsonResponse) throw new Error("Empty response from Groq");

        const parsedMapping = JSON.parse(jsonResponse);

        // Sanitize mapping to only include known layers and available meta fields
        const finalMapping: Record<string, string> = {};
        for (const layer of layers) {
            const mappedField = parsedMapping[layer.name];
            if (mappedField && AVAILABLE_META_FIELDS.includes(mappedField)) {
                finalMapping[layer.name] = mappedField;
            }
        }

        const hasMappings = Object.keys(finalMapping).length > 0;

        // Fetch template to update existing variants
        const currentTemplate = await prisma.template.findUnique({ where: { key: templateId } });
        if (!currentTemplate) throw new Error("Template not found");

        // Deep clone variants to ensure Prisma detects changes in JSON
        const existingVariants: any[] = JSON.parse(JSON.stringify(Array.isArray((currentTemplate as any).variants) ? (currentTemplate as any).variants : []));

        // Target variant by type or first one if not specified
        let targetVariantIndex = existingVariants.findIndex(v => v.type === (variantType || 'MAIN'));

        if (targetVariantIndex === -1) {
            // If no MAIN exists and we are mapping MAIN, or if specific type missing
            existingVariants.push({
                type: variantType || 'MAIN',
                mapping: finalMapping,
                layers: layers // Store layers structure too if we have it
            });
            targetVariantIndex = existingVariants.length - 1;
        } else {
            existingVariants[targetVariantIndex].mapping = finalMapping;
            // Also preserve/update layers if provided
            if (layers && layers.length > 0) {
                existingVariants[targetVariantIndex].layers = layers;
            }
        }

        // Calculate status: If all text layers are mapped, it's ACTIVE (READY)
        const totalTextLayers = layers.filter(l => l.type === 'TEXT').length;
        const mappedTextLayers = Object.keys(finalMapping).length;

        let newStatus = 'NEEDS_REVIEW'; // Default
        if (totalTextLayers > 0 && mappedTextLayers >= totalTextLayers) {
            newStatus = 'ACTIVE';
        } else if (totalTextLayers === 0) {
            newStatus = 'ACTIVE'; // Nothing to map
        }

        const template = await prisma.template.update({
            where: { key: templateId },
            data: {
                variants: existingVariants as any,
                mappedPaths: mappedTextLayers,
                status: newStatus,
                updatedAt: new Date()
            } as any
        });

        return NextResponse.json({
            success: true,
            mapping: finalMapping,
            status: newStatus,
            message: `Namapovaných ${Object.keys(finalMapping).length} z ${totalTextLayers} textových polí`
        });

    } catch (error: any) {
        console.error("[AIMapping] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
