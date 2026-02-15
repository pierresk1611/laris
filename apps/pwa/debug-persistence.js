const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🔍 TESTING DATABASE PERSISTENCE...");

    // 1. Define a test key
    const TEST_KEY = 'DEBUG_PERSISTENCE_TEST';
    const TEST_VALUE = 'TestValue-' + Date.now();

    // 2. Try to UPSERT (Save)
    console.log(`\n1. Saving key '${TEST_KEY}' with value '${TEST_VALUE}'...`);
    try {
        await prisma.setting.upsert({
            where: { id: TEST_KEY },
            update: { value: TEST_VALUE, category: 'DEBUG', isSecret: false },
            create: { id: TEST_KEY, value: TEST_VALUE, category: 'DEBUG', isSecret: false }
        });
        console.log("✅ Save (Upsert) successful.");
    } catch (e) {
        console.error("❌ Save FAILED:", e);
        return;
    }

    // 3. Try to READ (Get)
    console.log(`\n2. Reading key '${TEST_KEY}'...`);
    const valid = await prisma.setting.findUnique({
        where: { id: TEST_KEY }
    });

    if (valid && valid.value === TEST_VALUE) {
        console.log(`✅ Read successful. Value matches: ${valid.value}`);
    } else {
        console.error("❌ Read FAILED or mismatch.", valid);
    }

    // 4. Check Dropbox Keys specifically
    console.log("\n3. Checking specific DROPBOX keys in DB:");
    const dbxKeys = ['DROPBOX_REFRESH_TOKEN', 'DROPBOX_APP_KEY', 'DROPBOX_APP_SECRET', 'DROPBOX_FOLDER_PATH'];
    for (const k of dbxKeys) {
        const record = await prisma.setting.findUnique({ where: { id: k } });
        console.log(`   [${k}]: ${record ? (record.isSecret ? 'EXISTS (Secret)' : `"${record.value}"`) : 'MISSING ❌'}`);
    }

    // cleanup
    await prisma.setting.delete({ where: { id: TEST_KEY } });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
