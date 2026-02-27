const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Updating AGENT_ACCESS_TOKEN...");
    const token = 'secret-agent-token-123';

    await prisma.setting.upsert({
        where: { id: 'AGENT_ACCESS_TOKEN' },
        update: { value: token },
        create: {
            id: 'AGENT_ACCESS_TOKEN',
            value: token,
            category: 'AGENT',
            isSecret: true
        }
    });

    console.log(`Updated Token to: ${token}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
