import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

/**
 * POST /api/settings/save
 * Updates or creates a setting or shop.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("Settings save request:", JSON.stringify(body, null, 2));
        const { type, data } = body; // type: 'SETTING' | 'SHOP'

        if (type === 'SETTING') {
            const { id, value, category, isSecret } = data;
            console.log(`Saving setting: ${id} (isSecret: ${isSecret})`);

            // If value is masked, don't update it unless it changed
            if (isSecret && value === "********") {
                console.log("Secret unchanged, skipping value update");
                // Just update other fields if needed, but here we just return
                return NextResponse.json({ success: true, message: "Secret unchanged" });
            }

            const finalValue = isSecret ? encrypt(value) : value;
            console.log(`Final value length: ${finalValue.length}`);

            // @ts-ignore
            await prisma.setting.upsert({
                where: { id },
                update: { value: finalValue, category, isSecret },
                create: { id, value: finalValue, category, isSecret }
            });
            console.log(`Setting ${id} upserted successfully`);
        }
        else if (type === 'SHOP') {
            const { id, name, url, ck, cs } = data;
            console.log(`Saving shop: ${name} (id: ${id || 'new'})`);

            // Handle masking for shops too
            // @ts-ignore
            const existing = id ? await prisma.shop.findUnique({ where: { id } }) : null;

            const finalCK = (ck && ck.includes("********")) ? existing?.ck : ck;
            const finalCS = (cs && cs === "********") ? existing?.cs : cs;

            if (id) {
                // @ts-ignore
                await prisma.shop.update({
                    where: { id },
                    data: { name, url, ck: finalCK, cs: finalCS }
                });
                console.log(`Shop ${id} updated successfully`);
            } else {
                // @ts-ignore
                const newShop = await prisma.shop.create({
                    data: { name, url, ck: finalCK, cs: finalCS }
                });
                console.log(`Shop created successfully with id: ${newShop.id}`);
            }
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("CRITICAL Save settings error:", e);
        return NextResponse.json({
            success: false,
            error: e.message,
            stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
        }, { status: 500 });
    }
}
