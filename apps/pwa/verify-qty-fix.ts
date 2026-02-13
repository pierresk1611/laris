import { prisma } from './src/lib/prisma';
import { processOrders } from './src/lib/order-processor';

async function main() {
    const shop = await prisma.shop.findFirst();
    if (!shop) return;

    // Order #3437 is known to have 25 pozvánok
    const orderId = "3437";
    const res = await fetch(`${shop.url}/wp-json/wc/v3/orders/${orderId}?consumer_key=${shop.ck}&consumer_secret=${shop.cs}`);
    const rawOrder = await res.json();

    const processed = await processOrders([rawOrder], shop.url, shop.name, shop.id);
    const item = processed[0].items[0];

    console.log(`Order #${orderId}`);
    console.log(`  Processed Item: ${item.name}`);
    console.log(`  Processed Quantity: ${item.quantity}`);
    console.log(`  EPO Options:`, item.options);
}

main();
