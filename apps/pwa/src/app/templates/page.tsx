"use client";

import { useState, useRef, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import Link from "next/link";
import {
    Layers,
    Search,
    MoreHorizontal,
    FolderOpen,
    RefreshCw,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";

interface Template {
    key: string;
    name: string;
    mappedPaths: number;
    status: string;
    isVerified: boolean;
    imageUrl?: string | null;
}

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<{ date: string; status: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [templatesRes, settingsRes] = await Promise.all([
                fetch('/api/templates'),
                fetch('/api/settings')
            ]);

            const templatesData = await templatesRes.json();
            const settingsData = await settingsRes.json();

            if (templatesData.success) {
                // Sort: Verified first, then alphabetically
                const sorted = templatesData.templates.sort((a: Template, b: Template) => {
                    if (a.isVerified && !b.isVerified) return -1;
                    if (!a.isVerified && b.isVerified) return 1;
                    return a.key.localeCompare(b.key);
                });
                setTemplates(sorted);
            }

            // Extract last sync info from settings
            const syncDate = settingsData.settings?.find((s: any) => s.id === 'LAST_DROPBOX_SYNC')?.value;
            const syncStatus = settingsData.settings?.find((s: any) => s.id === 'LAST_DROPBOX_SYNC_STATUS')?.value;

            if (syncDate) {
                setLastSync({ date: syncDate, status: syncStatus || 'OK' });
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDropboxSync = async () => {
        setIsSyncing(true);

        const syncPromise = async () => {
            let hasMore = true;
            let cursor: string | null = null;
            let totalCount = 0;
            let batchCount = 0;

            while (hasMore) {
                // Fetch batch
                const response = await fetch('/api/templates/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cursor })
                });

                if (!response.ok) {
                    const text = await response.text();
                    let errorDetails = `Status ${response.status}`;
                    try {
                        const data = JSON.parse(text);
                        errorDetails = data.message || data.details || errorDetails;
                    } catch (e) { }
                    throw new Error(errorDetails);
                }

                const data: { success: boolean, hasMore: boolean, cursor: string | null, count: number, message?: string } = await response.json();
                if (!data.success) throw new Error(data.message || 'Sync failed');

                // Update state for next loop
                cursor = data.cursor;
                hasMore = data.hasMore;
                const currentCount = data.count || 0;
                totalCount += currentCount;
                batchCount++;

                // Optional: Log progress (Toast updates are tricky in promise, so we rely on console or final msg)
                console.log(`[SyncLoop] Batch ${batchCount} done. Added ${currentCount} templates. HasMore: ${hasMore}`);
            }

            return { message: `Synchronizácia dokončená. Spracovaných a aktualizovaných ${totalCount} šablón.` };
        };

        toast.promise(syncPromise(), {
            loading: 'Synchronizujem Dropbox (môže to chvíľu trvať)...',
            success: (data) => {
                setIsSyncing(false);
                fetchData();
                return data.message;
            },
            error: (err: any) => {
                setIsSyncing(false);
                console.error('[DropboxSyncToast] Error:', err);
                const msg = err.message || 'Neznáma chyba';
                return `SYNC_CHYBA: ${msg}`;
            }
        });
    };

    return (
        <div>
            <AppHeader title="Šablóny" />

            {/* Sync Status Bar */}
            <div className="flex items-center gap-6 mb-8 px-6 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-2 text-slate-400">
                    <Clock size={14} />
                    <span>Posledná synchronizácia:</span>
                    <span className="text-slate-900">
                        {lastSync ? new Date(lastSync.date).toLocaleString('sk-SK') : 'Nikdy'}
                    </span>
                </div>
                <div className="h-4 w-[1px] bg-slate-100" />
                <div className="flex items-center gap-2">
                    {lastSync?.status === 'OK' ? (
                        <>
                            <CheckCircle2 size={14} className="text-green-500" />
                            <span className="text-green-600">Stav: OK</span>
                        </>
                    ) : lastSync ? (
                        <>
                            <XCircle size={14} className="text-red-500" />
                            <span className="text-red-600">Stav: Chyba ({lastSync.status.replace('ERROR: ', '')})</span>
                        </>
                    ) : (
                        <span className="text-slate-400">Stav: Žiadne dáta</span>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Hľadať šablónu (napr. JSO)..."
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* CSV Import moved to Settings -> Database */}

                    <button
                        onClick={handleDropboxSync}
                        disabled={isSyncing}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                        <span>{isSyncing ? 'Synchronizujem...' : 'Import z Dropboxu'}</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 h-64 animate-pulse">
                            <div className="w-full h-32 bg-slate-50 rounded-2xl mb-4" />
                            <div className="w-24 h-6 bg-slate-50 rounded-lg mb-2" />
                            <div className="w-48 h-4 bg-slate-50 rounded-md" />
                        </div>
                    ))
                ) : templates.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                        <Layers size={48} className="mx-auto text-slate-200 mb-4" />
                        <h3 className="text-lg font-bold text-slate-400">Žiadne šablóny nenájdené</h3>
                        <p className="text-sm text-slate-400">Skúste synchronizovať s Dropboxom</p>
                    </div>
                ) : (
                    templates.map((template: Template) => (
                        <Link href={`/templates/${encodeURIComponent(template.key)}`} key={template.key}>
                            <div className={`cursor-pointer bg-white rounded-3xl border transition-all group flex flex-col h-full overflow-hidden ${template.isVerified ? 'border-green-200 shadow-green-100 ring-1 ring-green-100 shadow-sm' : 'border-slate-100 shadow-sm hover:shadow-md'}`}>

                                {/* Thumbnail */}
                                <div className="h-48 bg-slate-50 w-full relative border-b border-slate-100">
                                    {template.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={template.imageUrl} alt={template.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                            <ImageIcon size={32} strokeWidth={1} />
                                        </div>
                                    )}

                                    {template.isVerified && (
                                        <div className="absolute top-3 right-3 px-3 py-1.5 bg-green-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg flex items-center gap-1.5 z-10">
                                            <CheckCircle2 size={12} />
                                            Overená
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 flex flex-col flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-2 rounded-xl transition-colors ${template.isVerified ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                            <Layers size={18} />
                                        </div>
                                        <button className="p-2 text-slate-400 hover:text-slate-600">
                                            <MoreHorizontal size={20} />
                                        </button>
                                    </div>

                                    <h3 className="text-lg font-black text-slate-900 mb-1">{template.key}</h3>
                                    <p className="text-xs font-medium text-slate-500 mb-6 line-clamp-2">{template.name}</p>

                                    <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-auto">
                                        <div className="flex items-center gap-2">
                                            <FolderOpen size={14} className="text-slate-400" />
                                            <span className="text-[10px] font-bold text-slate-500">{template.mappedPaths} polí</span>
                                        </div>
                                        {template.status === 'ACTIVE' && (
                                            <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
                                                Aktívna
                                            </span>
                                        )}
                                        {template.status === 'UNMAPPED' && (
                                            <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-yellow-50 text-yellow-600 border border-yellow-100">
                                                Nemapovaná
                                            </span>
                                        )}
                                        {template.status !== 'ACTIVE' && template.status !== 'UNMAPPED' && (
                                            <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-red-50 text-red-600">
                                                Chyba
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
