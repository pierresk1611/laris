import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

/**
 * GET /api/settings
 * Returns all settings and all shops.
 */
export async function GET() {
    try {
        const settings = await prisma.setting.findMany();
        const shops = await prisma.shop.findMany();

        // Mask secret values for the frontend
        const maskedSettings = settings.map(s => ({
            ...s,
            value: s.isSecret ? "********" : s.value
        }));

        const maskedShops = shops.map(s => ({
            ...s,
            cs: "********",
            ck: s.ck ? s.ck.substring(0, 4) + "********" : ""
        }));

        return NextResponse.json({
            success: true,
            settings: maskedSettings,
            shops: maskedShops
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

/**
 * POST /api/settings/save
 * Updates or creates a setting or shop.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { type, data } = body; // type: 'SETTING' | 'SHOP'

        if (type === 'SETTING') {
            const { id, value, category, isSecret } = data;

            // If value is masked, don't update it unless it changed
            if (isSecret && value === "********") {
                // Just update other fields if needed, but here we just return
                return NextResponse.json({ success: true, message: "Secret unchanged" });
            }

            const finalValue = isSecret ? encrypt(value) : value;

            await prisma.setting.upsert({
                where: { id },
                update: { value: finalValue, category, isSecret },
                create: { id, value: finalValue, category, isSecret }
            });
        }
        else if (type === 'SHOP') {
            const { id, name, url, ck, cs } = data;

            // Handle masking for shops too
            const existing = id ? await prisma.shop.findUnique({ where: { id } }) : null;

            const finalCK = (ck && ck.includes("********")) ? existing?.ck : ck;
            const finalCS = (cs && cs === "********") ? existing?.cs : cs;

            if (id) {
                await prisma.shop.update({
                    where: { id },
                    data: { name, url, ck: finalCK, cs: finalCS }
                });
            } else {
                await prisma.shop.create({
                    data: { name, url, ck: finalCK, cs: finalCS }
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Save settings error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
