import { PrismaClient } from '@prisma/client';
import { extractTemplateKey } from './src/lib/parser';

const prisma = new PrismaClient();

async function main() {
    const products = await prisma.webProduct.findMany({ take: 20, orderBy: { id: 'desc' } });

    for (const p of products) {
        const key = extractTemplateKey(p.title, p.sku || undefined);
        console.log(`Title: "${p.title}" | SKU: "${p.sku}" => Extracted: ${key}`);
    }
}

main().finally(() => prisma.$disconnect());
