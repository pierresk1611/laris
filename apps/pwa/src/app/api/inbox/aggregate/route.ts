import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    console.log("[InboxAggregate] Starting aggregation...");
    try {
        // 1. Fetch all UNCLASSIFIED items
        // @ts-ignore
        const items = await prisma.fileInbox.findMany({
            where: { status: 'UNCLASSIFIED' }
        });

        if (items.length === 0) {
            return NextResponse.json({ success: true, message: 'No items to aggregate.', count: 0 });
        }

        // 2. Group by Basename
        // Map<Basename, { source: Item[], preview: Item[], others: Item[] }>
        const groups = new Map();

        // Regex to strip extensions and common suffixes like _preview, _thumb, etc if needed.
        // For now, strict basename check: "8.ai" -> "8"

        for (const item of items) {
            const name = item.name;
            const ext = item.extension.toLowerCase();
            const basename = name.substring(0, name.lastIndexOf('.'));

            // Naming Convention v2 -> ad_[SKU]_[O/P]_[Name]
            const v2Match = basename.match(/^ad_(.*?)_([OP])_(.*)$/i);

            // Grouping key: either SKU (if V2) or basename (if old format)
            const groupKey = v2Match ? v2Match[1].toUpperCase() : basename;

            if (!groups.has(groupKey)) {
                groups.set(groupKey, { source: [], preview: [], others: [] });
            }

            const group = groups.get(groupKey);

            if (['.ai', '.psd', '.psb', '.pdf'].includes(ext)) {
                group.source.push(item);
            } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
                group.preview.push(item);
            } else {
                group.others.push(item);
            }
        }

        console.log(`[InboxAggregate] Found ${groups.size} potential groups.`);

        let createdCount = 0;
        let processedFileIds: string[] = [];

        // 3. Process Groups
        for (const [basename, group] of groups) {
            // Rule: We need at least one SOURCE file to make a template. 
            // If we only have JPGs, it's just images, not a template.
            if (group.source.length === 0) continue;

            // Pick the "Best" source (AI > PSD > PDF)
            const mainSource = group.source.find((i: any) => i.extension === '.ai')
                || group.source.find((i: any) => i.extension === '.psd')
                || group.source[0];

            // Pick "Best" preview (JPG > PNG)
            const mainPreview = group.preview.find((i: any) => i.extension === '.jpg')
                || group.preview[0];

            // Template Key sanitation
            const key = basename.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();

            // Check existence (We use groupKey to check against V2 SKU if matched)
            const v2MatchForName = basename.match(/^ad_(.*?)_([OP])_(.*)$/i);
            const templateKeyToCheck = v2MatchForName ? v2MatchForName[1].toUpperCase() : key;

            const existingTemplate = await prisma.template.findUnique({ where: { key: templateKeyToCheck } });

            if (!existingTemplate) {
                // Determine Name - if V2, we might want to use the [Name] part
                const templateName = v2MatchForName ? v2MatchForName[3].replace(/_/g, ' ') : basename.replace(/_/g, ' ');

                // Create NEW Template
                // @ts-ignore
                const newTemplate = await prisma.template.create({
                    data: {
                        key: templateKeyToCheck,
                        name: templateName,
                        status: 'UNVERIFIED', // Needs Agent Scan
                        isVerified: false,
                        imageUrl: mainPreview ? (await getPublicUrl(mainPreview.path)) : null
                    }
                });
                createdCount++;

                // Trigger Layer Scan Job
                if (mainSource) {
                    // @ts-ignore
                    await prisma.job.create({
                        data: {
                            type: 'SCAN_LAYERS',
                            status: 'PENDING',
                            payload: {
                                templateKey: key,
                                templateId: newTemplate.id,
                                path: mainSource.path, // Dropbox path e.g. /TEMPLATES/8.ai
                                filename: mainSource.name
                            }
                        }
                    });
                    console.log(`[InboxAggregate] Created SCAN_LAYERS job for ${key}`);
                }
            }

            // Mark items as PROCESSED
            const allInGroup = [...group.source, ...group.preview, ...group.others];
            processedFileIds.push(...allInGroup.map((i: any) => i.id));
        }

        // 4. Batch Update Inbox Status
        if (processedFileIds.length > 0) {
            // @ts-ignore
            await prisma.fileInbox.updateMany({
                where: { id: { in: processedFileIds } },
                data: { status: 'PROCESSED' }
            });
        }

        // 5. Trigger Layer Scan Jobs? 
        // We can do this separately or here. Let's return success and let UI trigger individual scans or auto-scan.
        // For "Auto-Mapping" button, we probably want to queue scans immediately.
        // REQUIRED: Logic to create Job for new templates.

        // Let's create jobs for the NEWly created templates
        // We'd need to fetch them back or restructure the loop.
        // For MVP aggregation, let's just group them. The "Layer Scan" is a separate step usually?
        // User asked: "Spustiť Auto-Mapping" -> Agregácia + Scan.
        // So yes, we should queue jobs.

        // TODO: Queue jobs. For now, just aggregation.

        return NextResponse.json({
            success: true,
            message: `Agregácia dokončená. Vytvorených ${createdCount} šablón. Spracovaných ${processedFileIds.length} súborov.`,
            count: createdCount
        });

    } catch (error) {
        console.error("[InboxAggregate] Error:", error);
        return NextResponse.json({ success: false, error: 'Aggregation failed' }, { status: 500 });
    }
}

// Helper (mock for now, real one would use Dropbox API to get temporary link or use cached one)
async function getPublicUrl(path: string) {
    return null; // TODO: Implement thumbnail fetching
}
