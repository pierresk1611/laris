import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Hľadám a spájam duplikáty pozvánok...");

    // We look for templates that end with " P" or " P-01" etc.
    const allTemplates = await prisma.template.findMany({
        include: { files: true, webProducts: true }
    });

    console.log(`Analyzujem ${allTemplates.length} šablón v databáze.`);

    let mergeCount = 0;

    for (const inviteTemplate of allTemplates) {
        // Match things like "2022 18 P", "2022_18_P", "2022 18 P-01"
        // We know from the screenshot "2022_18_P-01", key: "2022_18_P-01" or similar
        const key = inviteTemplate.key.toUpperCase();

        let parentKey = null;

        // Very specific matching based on observed keys
        if (key.endsWith(' P')) {
            parentKey = key.slice(0, -2).trim();
        } else if (key.endsWith('_P')) {
            parentKey = key.slice(0, -2).trim();
        } else if (key.includes('_P-')) {
            parentKey = key.split('_P-')[0].trim();
        } else if (key.includes(' P-')) {
            parentKey = key.split(' P-')[0].trim();
        }

        if (parentKey && parentKey !== key) {
            console.log(`\nNašiel som potencionálnu pozvánku: ${key}. Hľadám nadradenú šablónu: ${parentKey}`);

            const parentTemplate = allTemplates.find(t => t.key.toUpperCase() === parentKey);

            if (parentTemplate) {
                console.log(`✅ NADRADENÁ ŠABLÓNA NÁJDENÁ (${parentTemplate.key}). Presúvam súbory...`);

                // Move files to parent
                for (const file of inviteTemplate.files) {
                    // Update file to point to parent template, and change its type to INVITE if it isn't already
                    try {
                        await prisma.templateFile.update({
                            where: { id: file.id },
                            data: {
                                templateId: parentTemplate.id,
                                type: 'INVITE'
                            }
                        });
                        console.log(`   -> Presunutý súbor ${file.path} do nadradenej šablóny ako INVITE.`);
                    } catch (e) {
                        console.log(`   -> ⚠️ Súbor ${file.path} sa nepodarilo presunúť (asi už existuje). Preskakujem.`);
                    }
                }

                // Unmap products just in case (we already did clear-mappings earlier, but safety first)
                await prisma.webProduct.updateMany({
                    where: { templateId: inviteTemplate.id },
                    data: { templateId: parentTemplate.id }
                });

                // Delete the duplicate invite template
                await prisma.template.delete({
                    where: { id: inviteTemplate.id }
                });

                console.log(`🗑️ Duplikát ${inviteTemplate.key} vymazaný.`);
                mergeCount++;
            } else {
                console.log(`❌ Nadradená šablóna ${parentKey} NEEXISTUJE. Ponechávam ako samostatnú šablónu.`);
            }
        }
    }

    console.log(`\nHotovo. Úspešne zlúčených ${mergeCount} duplikátov šablón.`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
