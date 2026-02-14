import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';

// Regex to extract template code (e.g., KSO 93, SNAP 15, NO 123)
// Looks for patterns at the end of the string or separated by spaces
const TEMPLATE_CODE_REGEX = /\b([A-Z]{2,5}\s?\d{2,4}[a-zA-Z]?)\b/i;

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ success: false, message: 'Žiadny súbor nebol nahraný.' }, { status: 400 });
        }

        const csvText = await file.text();

        // Parse CSV
        const { data, errors } = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim().toLowerCase() // Normalize headers
        });

        if (errors.length > 0) {
            console.error('CSV Parsing Errors:', errors);
        }

        const records = data as any[];
        let importedCount = 0;
        let matchedCount = 0;

        console.log(`[CatalogImport] Processing ${records.length} records...`);

        for (const row of records) {
            // Adjust these keys based on actual CSV headers
            const title = row['názov'] || row['title'] || row['product name'] || '';
            const internalId = row['id'] || row['kód'] || row['code'] || '';
            const category = row['kategória'] || row['category'] || '';
            const imageUrl = row['obrázok'] || row['image'] || row['image url'] || '';

            if (!title) continue;

            // 1. Extract Template Code
            const match = title.match(TEMPLATE_CODE_REGEX);
            let templateCode = match ? match[1].replace(/\s+/g, '').toUpperCase() : null;

            // Fallback: Check if internal ID looks like a template code
            if (!templateCode && internalId && TEMPLATE_CODE_REGEX.test(internalId)) {
                templateCode = internalId.replace(/\s+/g, '').toUpperCase();
            }

            if (templateCode) {
                // 2. Upsert into VerifiedTemplate
                await prisma.verifiedTemplate.upsert({
                    where: { template_code: templateCode },
                    update: {
                        title: title,
                        internal_id: internalId,
                        category: category,
                        image_url: imageUrl
                    },
                    create: {
                        template_code: templateCode,
                        title: title,
                        internal_id: internalId,
                        category: category,
                        image_url: imageUrl
                    }
                });
                importedCount++;

                // 3. Mark existing Template as verified
                // We check if the templateCode matches existing keys in Template table
                // Note: Template table keys might have spaces (e.g. "KSO 15") while we stored "KSO15"
                // So we need to be flexible or standardise.
                // Current sync standardizes to "KSO 15" (folder name).
                // Let's try to match both "KSO15" and "KSO 15".

                const formattedCodeSpace = templateCode.replace(/([A-Z]+)(\d+)/, '$1 $2'); // KSO15 -> KSO 15

                const updated = await prisma.template.updateMany({
                    where: {
                        OR: [
                            { key: templateCode },
                            { key: formattedCodeSpace }
                        ]
                    },
                    data: {
                        isVerified: true,
                        imageUrl: imageUrl
                    }
                });

                if (updated.count > 0) matchedCount += updated.count;
            }
        }

        return NextResponse.json({
            success: true,
            imported: importedCount,
            matched: matchedCount,
            message: `Importovaných ${importedCount} produktov. Napárovaných ${matchedCount} existujúcich šablón.`
        });

    } catch (error: any) {
        console.error('[CatalogImport] Error:', error);
        return NextResponse.json({ success: false, message: error.message || 'Import zlyhal.' }, { status: 500 });
    }
}
