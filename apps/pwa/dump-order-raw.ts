import { prisma } from './src/lib/prisma';

async function main() {
    const shop = await prisma.shop.findFirst();
    if (!shop) return;

    const orderId = "3429";
    const res = await fetch(`${shop.url}/wp-json/wc/v3/orders/${orderId}?consumer_key=${shop.ck}&consumer_secret=${shop.cs}`);
    const rawOrder = await res.json();

    console.log("FULL RAW ORDER #3429:");
    console.log(JSON.stringify(rawOrder, null, 2));
}

main();
