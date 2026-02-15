const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking DB Settings...");

    const keys = ['DROPBOX_APP_KEY', 'DROPBOX_APP_SECRET', 'DROPBOX_REFRESH_TOKEN'];

    for (const key of keys) {
        const setting = await prisma.setting.findUnique({
            where: { id: key }
        });

        console.log(`[${key}]:`, setting ? `Value: "${setting.value}" (IsSecret: ${setting.isSecret})` : "NOT FOUND (Will use .env)");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
