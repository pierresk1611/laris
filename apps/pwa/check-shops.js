const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const shops = await prisma.shop.findMany();
    console.log("Connected Shops:", shops.length);
    shops.forEach(s => {
        console.log(`ID: ${s.id} | Name: ${s.name} | URL: ${s.url} | Created: ${s.createdAt}`);
    });
}

main()
    .catch(e => { console.error(e); })
    .finally(async () => { await prisma.$disconnect(); });
