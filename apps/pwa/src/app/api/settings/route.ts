import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/settings
 * Returns all settings, shops and system stats.
 */
export async function GET() {
    try {
        // @ts-ignore
        const [settings, shops, patternCount] = await Promise.all([
            // @ts-ignore
            prisma.setting.findMany(),
            // @ts-ignore
            prisma.shop.findMany(),
            // @ts-ignore
            prisma.aiPattern.count()
        ]);

        // Mask secret values for the frontend
        const maskedSettings = settings.map((s: any) => ({
            ...s,
            value: s.isSecret ? "********" : s.value
        }));

        const maskedShops = shops.map((s: any) => ({
            ...s,
            cs: "********",
            ck: s.ck ? s.ck.substring(0, 4) + "********" : ""
        }));

        return NextResponse.json({
            success: true,
            settings: maskedSettings,
            shops: maskedShops,
            patternCount
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
