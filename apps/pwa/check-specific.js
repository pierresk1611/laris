const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const codes = ['PNO16', 'PNN07', 'KSO15'];
    console.log("Checking for specific types:");

    for (const code of codes) {
        const t = await prisma.template.findFirst({
            where: { key: { contains: code } }
        });
        console.log(`${code}: ${t ? `FOUND (Key: ${t.key}, Verified: ${t.isVerified})` : 'NOT FOUND'}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
