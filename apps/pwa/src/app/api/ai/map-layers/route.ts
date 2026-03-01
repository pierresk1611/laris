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

        const systemPrompt = `Si expertný asistent pre pred-tlačovú prípravu. Tvojou úlohou je priradiť textové vrstvy z Photoshop súboru k našim pevne definovaným systémovým meta-poliam na základe ich sémantického významu, názvu a HLAVNE ich skutočného textového obsahu (Content) pre svadobné/spoločenské oznámenia.

Dostupné systémové meta-polia:
${AVAILABLE_META_FIELDS.join(", ")}

Zoznam vrstiev z aktuálnej šablóny:
${layers.map((l: any) => `Layer: '${l.name}'${l.content ? `, Text Content: '${l.content}'` : ''}`).join("\n")}

PRAVIDLÁ:
1. Priraď (namapuj) len textové vrstvy, ktoré jednoznačne pasujú k meta-poľu na základe ich Názvu alebo Textového Obsahu.
2. Názvy ako "Meno", "Mená" alebo Textový obsah typu "Jano a Zuzka", "Marek", "Donoval" -> NAME_MAIN
3. Názvy ako "Datum", "Termin" alebo Textový obsah typu "10. júna 2025", "24_08_2024", "15.08.2023" -> DATE_MAIN
4. Názvy ako "Cas", "Hodina" alebo Textový obsah typu "15:00", "o 16:30 hod." -> TIME_MAIN
5. Názvy ako "Miesto", "Adresa" alebo Textový obsah typu "Kostol sv. Martina", "u mňa doma v Dubnici nad Váhom" -> PLACE_MAIN
6. Názvy ako "Text Oznámenia" alebo obsiahly text typu "Srdečne Vás pozývame", "S radosťou Vám oznamujeme" -> BODY_FULL
7. Názvy ako "Citát", "Motto" alebo krátke hlboké myšlienky -> QUOTE_TOP alebo QUOTE_BOTTOM
8. Názvy ako "Pozvánka k stolu", "Prijmite pozvanie" alebo text typu "Pozvánka k svadobnému stolu" -> INVITE_TEXT
9. Názvy ako "Pätička", "RSVP", "Kontakt" -> FOOTER_TEXT
10. Ak sa Názov vrstvy alebo jej Obsah hodí na meta pole, mapuj ho. Ak si nie si istý, ponechaj IGNORE. Názvy typu "Layer 1", "r1hiwwzjr461" ignoruj, *pokiaľ* ich textový obsah nedáva jasný zmysel (napr. ak je obsah "15:00", mapuj na TIME_MAIN).
11. Ak dostaneš na namapovanie vrstvu s názvom obsahujúcim 'BG', 'BACKGROUND', 'POZADIE' alebo ide o grafický element bez obsahu, vráť pre ňu hodnotu 'IGNORE'.
12. Tvoja odpoveď MUSÍ BYŤ LEN VALIDNÝ JSON vo formáte objektu, kde klúč je presný názov vrstvy (Názov z PSD) a hodnota je presný názov meta-poľa (alebo 'IGNORE'/null). Nepíšte žiadne komentáre ani markdown.`;


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

        // Calculate combined status and total mapped paths across ALL variants
        let allVariantsReady = true;
        let totalMappedPathsAcrossVariants = 0;

        for (const v of existingVariants) {
            const vMapping = v.mapping || {};
            const vLayers = v.layers || [];
            const vTextLayers = vLayers.filter((l: any) => l.type === 'TEXT').length;
            const vMappedCount = Object.keys(vMapping).length;

            totalMappedPathsAcrossVariants += vMappedCount;

            if (vTextLayers > 0 && vMappedCount < vTextLayers) {
                allVariantsReady = false;
            }
        }

        const newStatus = (allVariantsReady && totalMappedPathsAcrossVariants > 0) ? 'ACTIVE' : 'NEEDS_REVIEW';

        console.log(`[AIMapping] Persistence: totalMapped=${totalMappedPathsAcrossVariants}, status=${newStatus}`);

        const template = await prisma.template.update({
            where: { key: templateId },
            data: {
                variants: existingVariants as any,
                mappedPaths: totalMappedPathsAcrossVariants,
                status: newStatus,
                updatedAt: new Date()
            } as any
        });

        const totalTextLayers = layers.filter(l => l.type === 'TEXT').length;

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
