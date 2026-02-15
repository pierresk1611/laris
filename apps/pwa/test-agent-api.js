const fetch = require('node-fetch');

const API_URL = 'https://laris-automat.vercel.app/api';
const TOKEN = 'test-agent-token-1771061963957'; // From previous step

async function main() {
    console.log("--- Testing Agent API ---");

    // 1. Heartbeat
    console.log("1. Sending Heartbeat...");
    try {
        const res = await fetch(`${API_URL}/agent/heartbeat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
                status: 'ONLINE',
                version: '2.0.0',
                os: 'darwin'
            })
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`, data);
    } catch (e) {
        console.error("Heartbeat Failed:", e.message);
    }

    // 2. Fetch Jobs
    console.log("\n2. Fetching Pending Jobs...");
    try {
        const res = await fetch(`${API_URL}/agent/jobs?status=PENDING`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${TOKEN}`
            }
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Fetch Jobs Failed:", e.message);
    }
}

main();
