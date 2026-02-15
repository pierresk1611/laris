import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const agentToken = await getSetting('AGENT_ACCESS_TOKEN');

    if (!authHeader || authHeader !== `Bearer ${agentToken}`) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const appKey = await getSetting('DROPBOX_APP_KEY');
        const appSecret = await getSetting('DROPBOX_APP_SECRET');
        const refreshToken = await getSetting('DROPBOX_REFRESH_TOKEN');

        return NextResponse.json({
            success: true,
            config: {
                dropbox: {
                    appKey,
                    appSecret,
                    refreshToken
                }
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
