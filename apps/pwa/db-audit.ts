import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("=== DB Connection Audit ===");
    console.log("DATABASE_URL length:", process.env.DATABASE_URL?.length || 0);

    try {
        // 1. Check if table Setting exists and column names
        const result = await prisma.$queryRaw`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'Setting'
        `;
        console.log("Setting Table Schema:", JSON.stringify(result, null, 2));

        // 2. Try a test write
        const testId = "CONNECTION_TEST_" + Date.now();
        console.log(`Attempting test write to Setting: ${testId}`);
        await prisma.setting.create({
            data: {
                id: testId,
                value: "TEST_VALUE",
                category: "SYSTEM"
            }
        });
        console.log("Test write SUCCESS");

        // 3. Try to read it back
        const readBack = await prisma.setting.findUnique({ where: { id: testId } });
        console.log("Read back:", JSON.stringify(readBack, null, 2));

        // 4. Cleanup
        await prisma.setting.delete({ where: { id: testId } });
        console.log("Test cleanup SUCCESS");

    } catch (e: any) {
        console.error("DB AUDIT FAILED:", e.message);
        if (e.code) console.error("Prisma Error Code:", e.code);
        if (e.meta) console.error("Prisma Error Meta:", e.meta);
    } finally {
        await prisma.$disconnect();
    }
}

main();
