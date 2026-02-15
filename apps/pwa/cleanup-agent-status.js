const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Cleaning up AgentStatus...");
    const deleted = await prisma.agentStatus.deleteMany({});
    console.log(`Deleted ${deleted.count} agent status records.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
