
const { processOrders } = require('./src/lib/order-processor');

async function test() {
    const mockOrder = {
        id: 1234,
        number: "1234",
        status: "processing",
        billing: { first_name: "Peter", last_name: "Test" },
        line_items: [
            { id: 1, name: "Test Product JSO 15", quantity: 1, price: "10" }
        ],
        date_created: "2026-02-13T09:00:00"
    };

    try {
        console.log("Starting test...");
        const result = await processOrders([mockOrder], "https://test.sk", "Test Shop");
        console.log("Test result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Test failed globally:", e);
    }
}

test();
