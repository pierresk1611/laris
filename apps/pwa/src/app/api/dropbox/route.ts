import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    // In production, we'd fetch the token from process.env or a database
    const token = process.env.DROPBOX_TOKEN;

    if (!token) {
        return NextResponse.json({
            error: 'DROPBOX_TOKEN_MISSING',
            message: 'Dropbox access token is not configured in environment variables.'
        }, { status: 500 });
    }

    try {
        // This is where real Dropbox SDK/API calls would go
        // Example: const dbx = new Dropbox({ accessToken: token });

        const mockTemplates = [
            { name: 'JSO_15', path: '/TEMPLATES/JSO_15', lastModified: new Date().toISOString() },
            { name: 'VSO_02', path: '/TEMPLATES/VSO_02', lastModified: new Date().toISOString() },
            { name: 'JSO_22', path: '/TEMPLATES/JSO_22', lastModified: new Date().toISOString() },
        ];

        return NextResponse.json({
            success: true,
            templates: mockTemplates
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
