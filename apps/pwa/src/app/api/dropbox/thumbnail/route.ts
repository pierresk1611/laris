import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';
import { Dropbox } from 'dropbox';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { path } = await req.json();

        if (!path) {
            return NextResponse.json({ success: false, error: 'Path is required' }, { status: 400 });
        }

        // Check cache in DB first
        const existingFile = await prisma.fileInbox.findUnique({
            where: { path },
            select: { thumbnailData: true }
        });

        if (existingFile && existingFile.thumbnailData) {
            return NextResponse.json({ success: true, url: existingFile.thumbnailData });
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
        // Dropbox get_thumbnail_v2 supports: jpg, png, tiff, tif, gif, bmp, webp, ai, psd, psb
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

            // Save to DB cache to avoid future API calls
            try {
                await prisma.fileInbox.update({
                    where: { path },
                    data: { thumbnailData: dataUri }
                });
            } catch (cacheError) {
                console.warn("[DropboxThumbnail] Failed to save DB cache for path:", path);
            }

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
