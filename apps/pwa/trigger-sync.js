const http = require('http');

const PORT = 3000;
const URL = `http://localhost:${PORT}`;

async function triggerSyncs() {
    console.log("🚀 Starting Fresh Sync Process locally...");

    try {
        console.log("1. Triggering Dropbox Sync (/api/templates/sync)...");
        let res = await fetch(`${URL}/api/templates/sync`, { method: 'POST' });
        console.log("Dropbox Sync result:", await res.json());

        console.log("2. Triggering Inbox Aggregation (/api/inbox/aggregate)...");
        res = await fetch(`${URL}/api/inbox/aggregate`, { method: 'POST' });
        console.log("Inbox Aggregate result:", await res.json());

        console.log("3. Triggering WooCommerce Order Fetch (/api/woo/orders)...");
        res = await fetch(`${URL}/api/woo/orders`, { method: 'GET' });
        let data = await res.json();
        console.log(`Order Fetch result: Success? ${data.success}, Orders: ${data.orders ? data.orders.length : 0}`);

        // Note: CSV import requires uploading a file usually, so I will inform user to upload it via UI.

        console.log("✅ All triggers fired. Database should now be fresh with v2 templates!");
    } catch (e) {
        console.error("❌ Failed to trigger endpoints:", e.message);
        console.log("Please ensure 'npm run dev' is running on port 3000.");
    }
}

triggerSyncs();
