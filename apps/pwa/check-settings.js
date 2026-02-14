const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking Dropbox Settings in DB...");
    const keys = ['DROPBOX_ACCESS_TOKEN', 'DROPBOX_REFRESH_TOKEN', 'DROPBOX_APP_KEY', 'DROPBOX_APP_SECRET', 'DROPBOX_FOLDER_PATH'];

    for (const key of keys) {
        const s = await prisma.setting.findUnique({ where: { id: key } });
        console.log(`${key}: ${s ? (s.value ? 'PRESENT (len=' + s.value.length + ')' : 'EMPTY STRING') : 'MISSING'}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
