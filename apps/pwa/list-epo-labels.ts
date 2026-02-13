import { prisma } from './src/lib/prisma';

async function main() {
    const shop = await prisma.shop.findFirst();
    if (!shop) return;

    const res = await fetch(`${shop.url}/wp-json/wc/v3/orders?consumer_key=${shop.ck}&consumer_secret=${shop.cs}&per_page=20`);
    const orders = await res.json() as any[];

    const labels = new Set<string>();

    orders.forEach(order => {
        order.line_items.forEach((item: any) => {
            const epo = item.meta_data.find((m: any) => m.key === '_tmcartepo_data');
            if (epo && Array.isArray(epo.value)) {
                epo.value.forEach((v: any) => {
                    labels.add(v.name || v.label || "UNKNOWN");
                });
            }
        });
    });

    console.log("Unique EPO Labels found in last 20 orders:");
    console.log(Array.from(labels).sort());
}

main();
