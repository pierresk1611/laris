"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
    Image as ImageIcon,
    Inbox,
    FileText,
    Trash2,
    Wand2,
    ArrowRight
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

interface InboxItem {
    id: string;
    name: string;
    path: string;
    extension: string;
    status: string;
    prediction: { category: string, reasoning: string } | null;
    createdAt: string;
}

export default function TemplatesPage() {
    const [activeTab, setActiveTab] = useState<'TEMPLATES' | 'INBOX'>('TEMPLATES');

    // Templates State
    const [templates, setTemplates] = useState<Template[]>([]);

    // Inbox State
    const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Common State
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<{ date: string; status: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [templatesRes, settingsRes, inboxRes] = await Promise.all([
                fetch('/api/templates'),
                fetch('/api/settings'),
                fetch('/api/inbox')
            ]);

            const templatesData = await templatesRes.json();
            const settingsData = await settingsRes.json();
            const inboxData = await inboxRes.json();

            if (templatesData.success) {
                // Sort: Verified first, then alphabetically
                const sorted = templatesData.templates.sort((a: Template, b: Template) => {
                    if (a.isVerified && !b.isVerified) return -1;
                    if (!a.isVerified && b.isVerified) return 1;
                    return a.key.localeCompare(b.key);
                });
                setTemplates(sorted);
            }

            if (inboxData.success) {
                setInboxItems(inboxData.items);
            }

            // Extract last sync info from settings
            const syncDate = settingsData.settings?.find((s: any) => s.id === 'LAST_DROPBOX_SYNC')?.value;
            const syncStatus = settingsData.settings?.find((s: any) => s.id === 'LAST_DROPBOX_SYNC_STATUS')?.value;

            if (syncDate) {
                setLastSync({ date: syncDate, status: syncStatus || 'OK' });
            }
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error("Chyba pri načítaní dát.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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

                console.log(`[SyncLoop] Batch ${batchCount} done. Added ${currentCount} Inbox items. HasMore: ${hasMore}`);
            }

            return { message: `Synchronizácia dokončená. Skontrolujte Inbox (${totalCount} nových položiek).` };
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

    const runAiAnalysis = async () => {
        if (inboxItems.length === 0) {
            toast.info("Inbox je prázdny, nie je čo analyzovať.");
            return;
        }

        setIsAnalyzing(true);
        toast.info("Spúšťam AI analýzu...");

        try {
            const res = await fetch('/api/inbox/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: inboxItems })
            });
            const data = await res.json();

            if (data.success) {
                toast.success("AI analýza dokončená! Skontrolujte návrhy.");
                fetchData();
            } else {
                toast.error(`Chyba AI: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
            toast.error("Nepodarilo sa spustiť AI analýzu.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleClassify = async (id: string, action: 'TEMPLATE' | 'DOCUMENT' | 'IGNORE') => {
        // Optimistic update
        setInboxItems(prev => prev.filter(i => i.id !== id));

        try {
            const res = await fetch('/api/inbox/classify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action })
            });

            if (!res.ok) throw new Error("Chyba API");

            toast.success(
                action === 'TEMPLATE' ? "Pridané do šablón" :
                    action === 'DOCUMENT' ? "Označené ako dokument" : "Ignorované"
            );

            // Refetch to see new template if added
            if (action === 'TEMPLATE') {
                // Short delay to allow DB propagation if needed, or just fetch templates only
                fetchData();
            }

        } catch (e) {
            toast.error("Nepodarilo sa uložiť akciu.");
            fetchData(); // Revert
        }
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

            {/* Tabs & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">

                {/* Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('TEMPLATES')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'TEMPLATES'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Layers size={16} />
                        Aktívne Šablóny
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] ml-1">
                            {templates.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('INBOX')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'INBOX'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Inbox size={16} />
                        Inbox Súborov
                        {inboxItems.length > 0 && (
                            <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[10px] ml-1 animate-pulse">
                                {inboxItems.length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {activeTab === 'INBOX' && (
                        <button
                            onClick={runAiAnalysis}
                            disabled={isAnalyzing || inboxItems.length === 0}
                            className={`flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-2xl text-sm font-bold hover:bg-purple-700 transition-all shadow-xl shadow-purple-200 ${isAnalyzing ? 'opacity-70' : ''}`}
                        >
                            {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                            <span>AI Triedenie</span>
                        </button>
                    )}

                    <button
                        onClick={handleDropboxSync}
                        disabled={isSyncing}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                        <span>{isSyncing ? 'Skenovať Dropbox' : 'Skenovať Dropbox'}</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'TEMPLATES' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
                    {isLoading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 h-64 animate-pulse">
                                <div className="w-full h-32 bg-slate-50 rounded-2xl mb-4" />
                                <div className="w-24 h-6 bg-slate-50 rounded-lg mb-2" />
                            </div>
                        ))
                    ) : templates.length === 0 ? (
                        <div className="col-span-full py-20 text-center">
                            <Layers size={48} className="mx-auto text-slate-200 mb-4" />
                            <h3 className="text-lg font-bold text-slate-400">Žiadne aktívne šablóny</h3>
                            <p className="text-sm text-slate-400">Skontrolujte Inbox a pridajte nové šablóny.</p>
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
                                            <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${template.status === 'ACTIVE' ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-600'}`}>
                                                {template.status === 'ACTIVE' ? 'Aktívna' : 'Chyba'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            ) : (
                /* INBOX TAB */
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    {inboxItems.length === 0 ? (
                        <div className="py-20 text-center">
                            <Inbox size={48} className="mx-auto text-slate-200 mb-4" />
                            <h3 className="text-lg font-bold text-slate-400">Inbox je prázdny</h3>
                            <p className="text-sm text-slate-400">Skúste spustiť "Skenovať Dropbox" pre načítanie nových súborov.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">Súbor</th>
                                        <th className="px-6 py-4">AI Návrh</th>
                                        <th className="px-6 py-4 text-right">Akcia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {inboxItems.map((item) => {
                                        // Determine suggested action style based on prediction
                                        const isAiTemplate = item.prediction?.category === 'TEMPLATE';
                                        const isAiDoc = item.prediction?.category === 'DOCUMENT';
                                        const isAiIgnore = item.prediction?.category === 'IGNORE';

                                        return (
                                            <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                                                            <FileText size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">{item.path}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {item.prediction ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${isAiTemplate ? 'bg-green-100 text-green-700' :
                                                                    isAiDoc ? 'bg-blue-100 text-blue-700' :
                                                                        'bg-slate-100 text-slate-600'
                                                                }`}>
                                                                {item.prediction.category}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 italic">
                                                                {item.prediction.reasoning}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs italic">Čaká na analýzu...</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleClassify(item.id, 'TEMPLATE')}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isAiTemplate ? 'bg-green-600 text-white border-green-600 shadow-md transform scale-105' : 'bg-white text-slate-600 border-slate-200 hover:border-green-300 hover:text-green-600'}`}
                                                        >
                                                            <Layers size={14} />
                                                            Šablóna
                                                        </button>
                                                        <button
                                                            onClick={() => handleClassify(item.id, 'DOCUMENT')}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isAiDoc ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}
                                                        >
                                                            <FileText size={14} />
                                                            Dokument
                                                        </button>
                                                        <button
                                                            onClick={() => handleClassify(item.id, 'IGNORE')}
                                                            className={`p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all ${isAiIgnore ? 'text-red-500 bg-red-50' : ''}`}
                                                            title="Ignorovať"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
