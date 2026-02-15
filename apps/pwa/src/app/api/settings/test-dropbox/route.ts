import { NextResponse } from 'next/server';
import { refreshDropboxToken } from '@/lib/dropbox';
import { Dropbox } from 'dropbox';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { refreshToken, appKey, appSecret } = body;

        console.log("Testing Dropbox Connection with:", {
            hasRefreshToken: !!refreshToken,
            hasAppKey: !!appKey,
            hasAppSecret: !!appSecret
        });

        if (!refreshToken || !appKey || !appSecret) {
            return NextResponse.json({ success: false, error: "Missing credentials" }, { status: 400 });
        }

        // 1. Try to get Access Token
        const accessToken = await refreshDropboxToken(appKey, appSecret, refreshToken);

        // 2. Try to list files (proof of life)
        const dbx = new Dropbox({ accessToken, fetch: fetch });
        const folderPath = '/TEMPLATES'; // Standard path

        const response = await dbx.filesListFolder({
            path: folderPath,
            recursive: false,
            limit: 5
        });

        return NextResponse.json({
            success: true,
            message: `Connection Successful! Found ${response.result.entries.length} items in ${folderPath}.`,
            entries: response.result.entries.map(e => e.name)
        });

    } catch (error: any) {
        console.error("Dropbox Test Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message || "Unknown error during Dropbox test"
        }, { status: 500 });
    }
}
