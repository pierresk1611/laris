import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const shops = await prisma.shop.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, shops });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 503 });
    }
}

export async function POST(request: Request) {
    try {
        const { url, ck, cs } = await request.json();

        const shop = await prisma.shop.create({
            data: { url, ck, cs }
        });

        return NextResponse.json({ success: true, shop });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to add shop' }, { status: 400 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });

        await prisma.shop.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Delete failed' }, { status: 400 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, ...data } = body;

        const shop = await prisma.shop.update({
            where: { id },
            data
        });

        return NextResponse.json({ success: true, shop });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 400 });
    }
}
