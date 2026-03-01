import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Mažem všetky existujúce prepojenia produktov so šablónami...");
    const result = await prisma.webProduct.updateMany({
        data: {
            templateId: null,
            matchConfidence: 0
        }
    });
    console.log(`Úspešne zrušených ${result.count} prepojení. Všetky produkty sú teraz NENAPÁROVANÉ.`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
