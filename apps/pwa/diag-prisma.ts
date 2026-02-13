import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Checking Prisma Models...");
    try {
        // @ts-ignore
        console.log("Accessing prisma.template...");
        const templateCount = await prisma.template.count();
        console.log("Template count:", templateCount);

        // @ts-ignore
        console.log("Accessing prisma.setting...");
        const settingCount = await prisma.setting.count();
        console.log("Setting count:", settingCount);

        console.log("SUCCESS: Models accessible.");
    } catch (err: any) {
        console.error("DIAGNOSTIC FAILED:", err.message);
        if (err.stack) console.error(err.stack);
    } finally {
        await prisma.$disconnect();
    }
}

main();
