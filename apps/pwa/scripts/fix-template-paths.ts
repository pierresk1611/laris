import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("--- STARTING DATA MIGRATION: Fixing Template Paths ---");

    const templates = await prisma.template.findMany({
        include: { files: true }
    });

    console.log(`Found ${templates.length} total templates.`);

    let fixedCount = 0;
    let migratedCount = 0;

    for (const template of templates) {
        // 1. Ensure displayName is set
        if (!template.displayName && template.name) {
            await prisma.template.update({
                where: { id: template.id },
                data: { displayName: template.name }
            });
        }

        // 2. Migrate from variants JSON to TemplateFile if files are missing
        const jsonVariants = Array.isArray(template.variants) ? (template.variants as any[]) : [];

        // Even if files exist, we want to ensure they have paths
        for (const variant of jsonVariants) {
            let path = variant.path;

            // If path is missing or empty, try to find it in FileInbox by key/name
            if (!path || path === "null" || path === "") {
                console.log(`[FIX] Missing path for ${template.key} (${variant.type}). Searching Inbox...`);
                const inboxMatch = await prisma.fileInbox.findFirst({
                    where: {
                        name: {
                            contains: variant.key || template.key
                        }
                    }
                });

                if (inboxMatch) {
                    path = inboxMatch.path;
                    console.log(`[FIX] FOUND path in Inbox: ${path}`);
                    fixedCount++;
                } else {
                    console.warn(`[WARN] Could not find path for ${template.key} in Inbox.`);
                    continue;
                }
            }

            // Upsert into TemplateFile
            await prisma.templateFile.upsert({
                where: {
                    templateId_type: {
                        templateId: template.id,
                        type: variant.type || 'MAIN'
                    }
                },
                update: {
                    path: path,
                    extension: variant.extension,
                    mapping: variant.mapping || {},
                    layers: variant.layers || []
                },
                create: {
                    templateId: template.id,
                    type: variant.type || 'MAIN',
                    path: path,
                    extension: variant.extension,
                    mapping: variant.mapping || {},
                    layers: variant.layers || []
                }
            });
            migratedCount++;
        }
    }

    console.log(`--- MIGRATION FINISHED ---`);
    console.log(`Templates processed: ${templates.length}`);
    console.log(`Missing paths fixed: ${fixedCount}`);
    console.log(`File records created/updated: ${migratedCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
