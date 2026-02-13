import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/settings/test-woo
 * Tests connection to a WooCommerce site.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        let { url, ck, cs, shopId } = body;

        if (!url || !ck || !cs) {
            return NextResponse.json({ success: false, error: "Chýbajúce údaje pre test" }, { status: 400 });
        }

        // If credentials are masked, fetch them from the database
        if ((ck.includes("********") || cs === "********") && shopId) {
            const existing = await prisma.shop.findUnique({ where: { id: shopId } });
            if (existing) {
                if (ck.includes("********")) ck = existing.ck;
                if (cs === "********") cs = existing.cs;
            }
        }

        // Clean URL
        const cleanUrl = url.replace(/\/$/, "");
        const testUrl = `${cleanUrl}/wp-json/wc/v3/system_status`;

        // Use Basic Auth for better compatibility with different server configs
        const auth = Buffer.from(`${ck}:${cs}`).toString('base64');

        const response = await axios.get(testUrl, {
            headers: {
                'Authorization': `Basic ${auth}`
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
            const data = typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data);
            errorMsg = `Server vrátil chybu ${e.response.status}: ${data}`;
        }
        return NextResponse.json({ success: false, error: errorMsg });
    }
}
