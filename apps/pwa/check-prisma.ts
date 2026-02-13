import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Checking Prisma Models...");
    // @ts-ignore
    console.log("Available models:", Object.keys(prisma).filter(k => !k.startsWith('_')));

    try {
        // @ts-ignore
        const settingCount = await prisma.setting.count();
        console.log("Setting count:", settingCount);
    } catch (e) {
        console.error("Error accessing prisma.setting:", e);
    }
}

main();
