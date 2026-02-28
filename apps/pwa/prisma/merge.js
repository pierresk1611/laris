const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting template merge...");
    const templates = await prisma.template.findMany();

    let deletedCount = 0;
    let updatedCount = 0;

    for (const tpl of templates) {
        const match = tpl.key.match(/^(.*?)_([PO])$/i);

        if (match) {
            const baseKey = match[1];
            const variantType = match[2];

            let baseTemplate = await prisma.template.findUnique({ where: { key: baseKey } });

            if (!baseTemplate) {
                console.log(`Creating base template: ${baseKey}`);
                baseTemplate = await prisma.template.create({
                    data: {
                        key: baseKey,
                        name: baseKey,
                        status: tpl.status,
                        imageUrl: tpl.imageUrl,
                        variants: []
                    }
                });
            }

            const existingVariants = baseTemplate.variants || [];

            if (!existingVariants.find(v => v.key === tpl.key)) {
                existingVariants.push({
                    key: tpl.key,
                    type: variantType.toUpperCase(),
                    imageUrl: tpl.imageUrl
                });

                await prisma.template.update({
                    where: { key: baseKey },
                    data: {
                        variants: existingVariants,
                        imageUrl: baseTemplate.imageUrl || tpl.imageUrl
                    }
                });
                updatedCount++;
            }

            console.log(`Deleting duplicate: ${tpl.key}`);
            await prisma.template.delete({ where: { key: tpl.key } });
            deletedCount++;
        }
    }
    console.log(`DONE. Deleted ${deletedCount} duplicates, updated ${updatedCount} base templates.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
