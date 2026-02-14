const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Cleaning up Template table...");
    // Delete all templates that are NOT verified (just to be safe, though none are verified)
    // Or just delete all?
    // Let's delete all, as the user wants a fresh sync.
    const deleted = await prisma.template.deleteMany({});
    console.log(`Deleted ${deleted.count} templates.`);

    // Also clear the Last Sync status
    await prisma.setting.update({
        where: { id: 'LAST_DROPBOX_SYNC_STATUS' },
        data: { value: 'WAITING' }
    }).catch(() => { });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
