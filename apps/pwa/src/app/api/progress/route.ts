import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';

export async function GET() {
    try {
        const syncProgressJson = await getSetting('SYNC_PROGRESS');
        const aiProgressJson = await getSetting('AI_ANALYSIS_PROGRESS');
        const bulkProgressJson = await getSetting('BULK_MAP_PROGRESS');
        const wooSyncJson = await getSetting('WOO_SYNC_PROGRESS');
        const wooProductsJson = await getSetting('WOO_PRODUCTS_PROGRESS');

        let syncProgress = null;
        let aiProgress = null;
        let bulkProgress = null;
        let wooSync = null;
        let wooProducts = null;

        if (syncProgressJson) {
            try {
                syncProgress = JSON.parse(syncProgressJson);
                const lastUpdate = syncProgress.updatedAt ? new Date(syncProgress.updatedAt) : new Date();
                if (Date.now() - lastUpdate.getTime() > 300000) syncProgress = null;
            } catch (e) { }
        }

        if (aiProgressJson) {
            try {
                aiProgress = JSON.parse(aiProgressJson);
                const updatedAt = new Date(aiProgress.updatedAt);
                if (Date.now() - updatedAt.getTime() > 60000) aiProgress = null;
            } catch (e) { }
        }

        if (bulkProgressJson) {
            try {
                bulkProgress = JSON.parse(bulkProgressJson);
                const updatedAt = new Date(bulkProgress.updatedAt);
                // 5 minutes validity for bulk
                if (Date.now() - updatedAt.getTime() > 300000) bulkProgress = null;
            } catch (e) { }
        }

        if (wooSyncJson) {
            try {
                wooSync = JSON.parse(wooSyncJson);
                const updatedAt = new Date(wooSync.updatedAt);
                if (Date.now() - updatedAt.getTime() > 300000) wooSync = null;
            } catch (e) { }
        }

        if (wooProductsJson) {
            try {
                wooProducts = JSON.parse(wooProductsJson);
                const updatedAt = new Date(wooProducts.updatedAt);
                if (Date.now() - updatedAt.getTime() > 300000) wooProducts = null;
            } catch (e) { }
        }

        return NextResponse.json({
            success: true,
            sync: syncProgress,
            ai: aiProgress,
            bulkMap: bulkProgress,
            wooSync: wooSync,
            wooProducts: wooProducts
        });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch progress' }, { status: 500 });
    }
}
