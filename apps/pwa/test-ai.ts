import { POST } from './src/app/api/inbox/analyze/route';

async function run() {
    const req = {
        json: async () => ({
            items: [
                {
                    id: "test_id",
                    name: "Pozvanka na oslavu 50. narodenin 2025_41.psd",
                    path: "/LARIS PODKLADY/POZAVNKY/Pozvanka.psd",
                    extension: ".psd"
                }
            ]
        })
    };

    // @ts-ignore
    const res = await POST(req);
    const data = await res.json();
    console.log("RESPONSE:", data);
}

run();
