import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (!key) return NextResponse.json({ success: false, error: 'Key required' }, { status: 400 });

        const template = await prisma.template.findUnique({
            where: { key }
        });

        return NextResponse.json({ success: true, mapping: template?.mappingData || null });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 503 });
    }
}

export async function POST(request: Request) {
    try {
        const { key, mappingData } = await request.json();

        if (!key) return NextResponse.json({ success: false, error: 'Key required' }, { status: 400 });

        const template = await prisma.template.upsert({
            where: { key },
            update: {
                mappingData,
                mappedPaths: Object.keys(mappingData || {}).length
            },
            create: {
                key,
                name: key, // default name
                mappingData,
                mappedPaths: Object.keys(mappingData || {}).length
            }
        });

        return NextResponse.json({ success: true, template });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to save mapping' }, { status: 400 });
    }
}
