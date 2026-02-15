import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';

export async function GET() {
    try {
        const syncProgressJson = await getSetting('SYNC_PROGRESS');
        const aiProgressJson = await getSetting('AI_ANALYSIS_PROGRESS');

        let syncProgress = null;
        let aiProgress = null;

        if (syncProgressJson) {
            try {
                syncProgress = JSON.parse(syncProgressJson);
                // Check if stale (older than 1 minute)
                const updatedAt = new Date(syncProgress.updatedAt);
                if (Date.now() - updatedAt.getTime() > 60000) {
                    syncProgress = null; // Stale, process likely finished or died
                }
            } catch (e) { }
        }

        if (aiProgressJson) {
            try {
                aiProgress = JSON.parse(aiProgressJson);
                const updatedAt = new Date(aiProgress.updatedAt);
                if (Date.now() - updatedAt.getTime() > 60000) {
                    aiProgress = null;
                }
            } catch (e) { }
        }

        return NextResponse.json({
            success: true,
            sync: syncProgress,
            ai: aiProgress
        });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch progress' }, { status: 500 });
    }
}
