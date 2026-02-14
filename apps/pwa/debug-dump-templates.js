const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Template Records (First 100) ---");
    const templates = await prisma.template.findMany({ take: 100 });
    templates.forEach(t => console.log(`Key: '${t.key}'`));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
