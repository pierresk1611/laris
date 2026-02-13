import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const shops = await prisma.shop.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, shops });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: 'Database error', details: error.message }, { status: 503 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log('Shops API: POST attempt:', body);

        // Picking only allowed fields
        const { url, name, ck, cs } = body;

        const shop = await prisma.shop.create({
            data: {
                url: url || "",
                name: name || "Môj E-shop",
                ck: ck || "",
                cs: cs || ""
            }
        });

        console.log('Shops API: Created shop:', shop.id);
        return NextResponse.json({ success: true, shop });
    } catch (error: any) {
        console.error("Shop creation error:", error);
        return NextResponse.json({
            success: false,
            error: 'Failed to add shop',
            details: error.message
        }, { status: 400 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });

        await prisma.shop.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: 'Delete failed', details: error.message }, { status: 400 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        console.log('Shops API: PATCH attempt for id:', body.id);

        // Strictly whitelist fields for update
        const { id, url, name, ck, cs } = body;

        if (!id) throw new Error("Missing shop ID");

        const shop = await prisma.shop.update({
            where: { id },
            data: {
                url: url !== undefined ? url : undefined,
                name: name !== undefined ? name : undefined,
                ck: ck !== undefined ? ck : undefined,
                cs: cs !== undefined ? cs : undefined
            }
        });

        console.log('Shops API: Updated shop successful URL:', shop.url);
        return NextResponse.json({ success: true, shop });
    } catch (error: any) {
        console.error('Shops API: Update failed:', error);
        return NextResponse.json({ success: false, error: 'Update failed', details: error.message }, { status: 400 });
    }
}
