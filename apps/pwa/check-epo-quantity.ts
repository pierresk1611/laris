import { prisma } from './src/lib/prisma';
import { parseEPO } from './src/lib/parser';

async function main() {
    // This is a rough estimation since we don't store raw orders in DB, 
    // but we might have them in the console logs or we can fetch from API.
    // Instead, I'll check what we have in the Job payloads or similar if any.

    // Actually, I'll fetch from the WooCommerce API directly for a few orders 
    // to see the raw _tmcartepo_data.

    const shop = await prisma.shop.findFirst();
    if (!shop) return;

    const res = await fetch(`${shop.url}/wp-json/wc/v3/orders?consumer_key=${shop.ck}&consumer_secret=${shop.cs}&per_page=10`);
    const orders = await res.json() as any[];

    orders.forEach(order => {
        console.log(`Order #${order.id} (${order.number})`);
        order.line_items.forEach((item: any) => {
            console.log(`  Item: ${item.name} (Woo Qty: ${item.quantity})`);
            const epo = item.meta_data.find((m: any) => m.key === '_tmcartepo_data');
            if (epo && Array.isArray(epo.value)) {
                epo.value.forEach((v: any) => {
                    const label = v.name || "";
                    if (label.toLowerCase().includes("počet") || label.toLowerCase().includes("kus") || label.toLowerCase().includes("množ")) {
                        console.log(`    FOUND QUANTITY-LIKE EPO: [${label}] = ${v.value}`);
                    } else {
                        // console.log(`    EPO: [${label}] = ${v.value}`);
                    }
                });
            }
        });
    });
}

main();
