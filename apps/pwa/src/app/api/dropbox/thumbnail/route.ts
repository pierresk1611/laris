import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';
import { Dropbox } from 'dropbox';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { path } = await req.json();

        if (!path) {
            return NextResponse.json({ success: false, error: 'Path is required' }, { status: 400 });
        }

        // Fetch credentials
        const refreshTokenRaw = await getSetting('DROPBOX_REFRESH_TOKEN');
        const clientIdRaw = await getSetting('DROPBOX_APP_KEY');
        const clientSecretRaw = await getSetting('DROPBOX_APP_SECRET');
        const accessTokenRaw = await getSetting('DROPBOX_ACCESS_TOKEN');

        const refreshToken = refreshTokenRaw?.trim();
        const clientId = clientIdRaw?.trim();
        const clientSecret = clientSecretRaw?.trim();
        const accessToken = accessTokenRaw?.trim();

        let dbx: Dropbox;

        if (refreshToken && clientId && clientSecret) {
            dbx = new Dropbox({
                clientId,
                clientSecret,
                refreshToken,
                fetch
            });
        } else if (accessToken) {
            dbx = new Dropbox({
                accessToken,
                fetch
            });
        } else {
            return NextResponse.json({ success: false, error: 'CREDENTIALS_MISSING' }, { status: 401 });
        }

        // Get thumbnail
        const response: any = await dbx.filesGetThumbnailV2({
            resource: {
                ".tag": "path",
                "path": path
            },
            format: { '.tag': 'png' },
            size: { '.tag': 'w256h256' },
            mode: { '.tag': 'strict' }
        });

        // The Dropbox SDK attaches the fileBlob property when downloading files in Node
        if (response.result && response.result.fileBlob) {
            const buffer = await response.result.fileBlob.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const dataUri = `data:image/png;base64,${base64}`;

            return NextResponse.json({ success: true, url: dataUri });
        } else {
            return NextResponse.json({ success: false, error: 'Thumbnail blob payload missing' });
        }

    } catch (error: any) {
        console.error("[DropboxThumbnail] Error fetching thumbnail:", error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fetch thumbnail'
        }, { status: 500 });
    }
}
