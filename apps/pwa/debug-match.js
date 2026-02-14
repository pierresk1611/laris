const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- VerifiedTemplate Records (Total: " + await prisma.verifiedTemplate.count() + ") ---");
    const verified = await prisma.verifiedTemplate.findMany({ take: 20 });
    verified.forEach(v => console.log(`Code: '${v.template_code}' | Title: '${v.title}'`));

    console.log("\n--- Template Records (Total: " + await prisma.template.count() + ") ---");
    const templates = await prisma.template.findMany({ take: 20 });
    templates.forEach(t => console.log(`Key: '${t.key}' | Status: ${t.status} | Verified: ${t.isVerified}`));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
