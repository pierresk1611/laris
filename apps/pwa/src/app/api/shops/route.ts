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
        console.log('Shops API: POST request body:', body);

        if (!body || body.url === undefined || body.ck === undefined || body.cs === undefined) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields',
                details: 'URL, Consumer Key, and Consumer Secret must be provided (can be empty strings).'
            }, { status: 400 });
        }

        const { url, ck, cs } = body;

        const shop = await prisma.shop.create({
            data: { url, ck, cs }
        });

        return NextResponse.json({ success: true, shop });
    } catch (error: any) {
        console.error("Shop creation error:", error);
        return NextResponse.json({
            success: false,
            error: 'Failed to add shop',
            details: error.message,
            prisma_error_code: error.code
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
        console.log('Shops API: PATCH request body:', body);
        const { id, ...data } = body;

        const shop = await prisma.shop.update({
            where: { id },
            data
        });

        return NextResponse.json({ success: true, shop });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: 'Update failed', details: error.message }, { status: 400 });
    }
}
