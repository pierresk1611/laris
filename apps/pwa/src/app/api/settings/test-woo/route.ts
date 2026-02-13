import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

/**
 * POST /api/settings/test-woo
 * Tests connection to a WooCommerce site.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url, ck, cs } = body;

        if (!url || !ck || !cs) {
            return NextResponse.json({ success: false, error: "Chýbajúce údaje pre test" }, { status: 400 });
        }

        // Clean URL
        const cleanUrl = url.replace(/\/$/, "");
        const testUrl = `${cleanUrl}/wp-json/wc/v3/system_status`;

        const response = await axios.get(testUrl, {
            params: {
                consumer_key: ck,
                consumer_secret: cs
            },
            timeout: 10000
        });

        if (response.status === 200) {
            return NextResponse.json({
                success: true,
                message: "Spojenie úspešné!",
                version: response.data?.environment?.wc_version
            });
        } else {
            return NextResponse.json({
                success: false,
                error: `Chyba spojenia: ${response.status}`
            });
        }
    } catch (e: any) {
        let errorMsg = e.message;
        if (e.response) {
            errorMsg = `Server vrátil chybu ${e.response.status}: ${JSON.stringify(e.response.data)}`;
        }
        return NextResponse.json({ success: false, error: errorMsg });
    }
}
