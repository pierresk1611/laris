import { NextResponse } from 'next/server';
import { getSetting, updateProgress } from '@/lib/settings';

export async function POST(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const storedToken = await getSetting('AGENT_ACCESS_TOKEN');

    if (token !== storedToken) {
        return NextResponse.json({ success: false, message: 'Invalid Token' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { key, current, total, label, status } = body;

        if (!key) {
            return NextResponse.json({ success: false, message: 'Missing progress key' }, { status: 400 });
        }

        await updateProgress(key, current || 0, total || 100, label || 'Processing...', status || 'RUNNING');

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[AgentProgressAPI] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
