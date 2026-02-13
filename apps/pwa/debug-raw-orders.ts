import { prisma } from './src/lib/prisma';

async function main() {
    console.log("Fetching shop config...");
    const shop = await prisma.shop.findFirst({ orderBy: { createdAt: 'desc' } });

    if (!shop) {
        console.error("No shop found!");
        return;
    }

    console.log(`Connected to: ${shop.url} (${shop.name || 'Unnamed'})`);

    const rawUrl = shop.url.replace(/\/$/, "");
    const apiUrl = `${rawUrl}/wp-json/wc/v3/orders?consumer_key=${shop.ck}&consumer_secret=${shop.cs}&per_page=10`;

    console.log(`Fetching from API...`);

    try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(res.statusText);
        const orders: any[] = await res.json();

        console.log(`Found ${orders.length} orders.`);

        // Find specific order or just take the first one with EPO
        const targetOrder = orders.find((o: any) => o.id === 3429) || orders[0];

        if (targetOrder) {
            console.log(`\nAnalyzing Order #${targetOrder.id}:`);
            console.log("Line Items Metadata:");
            targetOrder.line_items.forEach((item: any) => {
                console.log(`Item: ${item.name}`);
                console.log(JSON.stringify(item.meta_data, null, 2));
            });
        }


    } catch (e) {
        console.error("API Error:", e);
    }
}

// Mock Prisma for script
// Actually, let's just use the direct DB connection string if prisma client fails in script context often due to path issues
// But let's try standard way first.

main().catch(console.error);
