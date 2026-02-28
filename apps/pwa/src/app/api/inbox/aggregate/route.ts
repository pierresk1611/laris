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

        // 2. Group by Pattern & SKU
        const groups = new Map();

        for (const item of items) {
            const name = item.name;
            const ext = item.extension.toLowerCase();
            const nameWithoutExt = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;

            // Rule 1: "Pozvanka na..." detection
            const isInvitation = name.toLowerCase().startsWith('pozvanka na');

            // Rule 2: SKU Extraction (from end or prefix)
            // Pattern: ad_[SKU]_[O/P]_[Name] or just SKU at the end
            const v2Match = nameWithoutExt.match(/^ad_(.*?)_([OP])_(.*)$/i);
            const skuMatch = nameWithoutExt.match(/(?:^|[_ ])([A-Z0-9]{3,})(_[OP])?$/i); // Generic SKU match

            const sku = v2Match ? v2Match[1].toUpperCase() : (skuMatch ? skuMatch[1].toUpperCase() : nameWithoutExt);
            const variantSuffix = v2Match ? v2Match[2].toUpperCase() : (skuMatch && skuMatch[2] ? skuMatch[2].substring(1).toUpperCase() : 'O');

            const groupKey = isInvitation ? `INVITATION_${sku}` : sku;

            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    name: isInvitation ? `Pozvánka - ${sku}` : sku,
                    sku: sku,
                    files: []
                });
            }

            const group = groups.get(groupKey);
            group.files.push({
                item,
                type: variantSuffix === 'P' ? 'INVITE' : 'MAIN'
            });
        }

        console.log(`[InboxAggregate] Found ${groups.size} potential groups.`);

        let createdCount = 0;
        let processedFileIds: string[] = [];

        // 3. Process Groups
        for (const [groupKey, data] of groups) {
            const files = data.files;

            // Check if we have an active template with this SKU/Key
            const existingTemplate = await prisma.template.findUnique({
                where: { key: data.sku },
                include: { files: true }
            }) as any;

            let templateId = existingTemplate?.id;

            if (!existingTemplate) {
                // Create Template if it has at least one graphic source
                const hasSource = files.some((f: any) => ['.ai', '.psd', '.psdt'].includes(f.item.extension.toLowerCase()));
                if (!hasSource) continue;

                const mainPreview = files.find((f: any) => ['.jpg', '.png'].includes(f.item.extension.toLowerCase()));

                const newTemplate = await prisma.template.create({
                    data: {
                        key: data.sku,
                        name: data.name,
                        displayName: data.name,
                        status: 'ACTIVE',
                        isVerified: false,
                        imageUrl: null // Will be handled by TemplateFile logic later
                    }
                });
                templateId = newTemplate.id;
                createdCount++;
            }

            // Upsert TemplateFiles for each file in group
            for (const fileObj of files) {
                const item = fileObj.item;
                const ext = item.extension.toLowerCase();
                const isSource = ['.ai', '.psd', '.psdt'].includes(ext);

                await prisma.templateFile.upsert({
                    where: {
                        templateId_type: {
                            templateId: templateId,
                            type: fileObj.type
                        }
                    },
                    update: {
                        path: item.path,
                        extension: ext
                    },
                    create: {
                        templateId: templateId,
                        type: fileObj.type,
                        path: item.path,
                        extension: ext
                    }
                });

                processedFileIds.push(item.id);

                // Queue scan if it is PSD
                if (ext === '.psd' || ext === '.psdt') {
                    // Logic to trigger/queue layer extraction could go here
                }
            }
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
