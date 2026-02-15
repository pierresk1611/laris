const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSettings() {
    try {
        const keys = ['DROPBOX_REFRESH_TOKEN', 'DROPBOX_APP_KEY', 'DROPBOX_APP_SECRET'];
        const settings = await prisma.setting.findMany({
            where: { id: { in: keys } }
        });

        console.log("Found Settings:");
        keys.forEach(key => {
            const s = settings.find(i => i.id === key);
            console.log(`${key}: ${s ? '✅ SET' : '❌ MISSING'}`);
        });

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

checkSettings();
