const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking AGENT_ACCESS_TOKEN...");
    let setting = await prisma.setting.findUnique({ where: { id: 'AGENT_ACCESS_TOKEN' } });

    if (!setting) {
        console.log("Token missing. Generating new one...");
        const token = 'test-agent-token-' + Date.now();
        await prisma.setting.create({
            data: {
                id: 'AGENT_ACCESS_TOKEN',
                value: token,
                category: 'AGENT',
                isSecret: true
            }
        });
        console.log(`Created Token: ${token}`);
    } else {
        console.log(`Token exists: ${setting.value}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
