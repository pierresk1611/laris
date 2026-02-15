const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🧹 Clearing Dropbox Settings from DB to force ENV usage...");

    const keys = ['DROPBOX_APP_KEY', 'DROPBOX_APP_SECRET', 'DROPBOX_REFRESH_TOKEN', 'DROPBOX_ACCESS_TOKEN'];

    const result = await prisma.setting.deleteMany({
        where: {
            id: { in: keys }
        }
    });

    console.log(`✅ Deleted ${result.count} settings. Application will now use .env variables.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
