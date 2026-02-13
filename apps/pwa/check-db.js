
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("DB Sanity Check...");
        const shop = await prisma.shop.findFirst();
        console.log("First shop found:", JSON.stringify(shop, null, 2));
        if (shop && shop.name) {
            console.log("SUCCESS: 'name' field exists and is accessible.");
        } else if (shop) {
            console.log("WARNING: Shop found but 'name' field is missing or empty.");
        } else {
            console.log("INFO: No shops found in DB.");
        }
    } catch (e) {
        console.error("DB Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
