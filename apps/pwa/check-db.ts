import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const state = await prisma.localOrderState.findUnique({
        where: {
            orderId_shopId: {
                shopId: "cmljwl0m60001lh0ay5rb9fqk",
                orderId: "3429"
            }
        }
    });

    console.log("Local Order State:", JSON.stringify(state, null, 2));

    const templates = await prisma.template.findMany({
        where: { key: { in: ["AVU 50", "2025_30"] } }
    });
    console.log("Templates in DB:", JSON.stringify(templates, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
