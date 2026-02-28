const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting DB Wipe...");

    // 1. Delete all FileInbox items
    const deletedInbox = await prisma.fileInbox.deleteMany({});
    console.log(`Deleted ${deletedInbox.count} items from FileInbox.`);

    // 2. Delete all UNVERIFIED Templates
    // Note: User said "okrem tých, ktoré už Mirka manuálne označila ako overené"
    const deletedTemplates = await prisma.template.deleteMany({
        where: {
            isVerified: false
        }
    });
    console.log(`Deleted ${deletedTemplates.count} unverified templates.`);

    console.log("Wipe complete.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
