import { NextResponse } from 'next/server';

export async function GET() {
    // Mocking Dropbox API response for now
    // In production, this would use the Dropbox SDK and process.env.DROPBOX_TOKEN
    const mockTemplates = [
        { name: 'JSO_15', path: '/TEMPLATES/JSO_15' },
        { name: 'VSO_02', path: '/TEMPLATES/VSO_02' },
        { name: 'JSO_22', path: '/TEMPLATES/JSO_22' },
    ];

    return NextResponse.json({ templates: mockTemplates });
}
