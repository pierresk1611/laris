"use client";

import { useState, useRef, useEffect, useCallback, useMemo, Fragment } from "react";
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
    ArrowRight,
    ChevronDown,
    ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface Template {
    key: string;
    name: string;
    mappedPaths: number;
    status: string;
    isVerified: boolean;
    imageUrl?: string | null;
    alias?: string;
    variants?: any[];
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

const ThumbnailViewer = ({ path, extension, className }: { path: string, extension: string, className?: string }) => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const ext = extension.toLowerCase();
    const isThumbnailSupported = ['.png', '.jpg', '.jpeg', '.ai', '.psd', '.psdt'].includes(ext);

    useEffect(() => {
        if (!isThumbnailSupported) return;

        const fetchThumb = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/dropbox/thumbnail', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path })
                });
                const data = await res.json();
                if (data.success && data.url) {
                    setImgSrc(data.url);
                }
            } catch (e) {
                console.error("Failed to load thumbnail", e);
            } finally {
                setLoading(false);
            }
        };

        fetchThumb();
    }, [path, isThumbnailSupported]);

    const getFallbackIcon = () => {
        switch (ext) {
            case '.ai': return <div className="w-full h-full bg-[#330000] text-[#ff7c00] font-black text-[11px] flex items-center justify-center">Ai</div>;
            case '.psd':
            case '.psdt': return <div className="w-full h-full bg-[#001d26] text-[#31a8ff] font-black text-[11px] flex items-center justify-center">Ps</div>;
            case '.pdf': return <div className="w-full h-full bg-red-100 text-red-600 font-bold text-[10px] flex items-center justify-center tracking-tighter">PDF</div>;
            case '.png':
            case '.jpg':
            case '.jpeg': return <div className="w-full h-full bg-slate-100 text-slate-400 flex items-center justify-center"><ImageIcon size={18} /></div>;
            default: return <div className="w-full h-full bg-slate-100 text-slate-400 flex items-center justify-center"><FileText size={18} /></div>;
        }
    };

    const defaultClass = "w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 shadow-sm";
    const wrapperClass = className || defaultClass;

    if (!isThumbnailSupported) {
        return (
            <div className={`${wrapperClass} flex items-center justify-center`}>
                {getFallbackIcon()}
            </div>
        );
    }

    if (loading) {
        return (
            <div className={`${wrapperClass} flex items-center justify-center animate-pulse`}>
                <div className="w-full h-full opacity-50 flex items-center justify-center">
                    {getFallbackIcon()}
                </div>
            </div>
        );
    }

    return (
        <div className={wrapperClass}>
            {imgSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgSrc} alt="thumbnail" className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    {getFallbackIcon()}
                </div>
            )}
        </div>
    );
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
                fetch('/api/templates', { cache: 'no-store' }),
                fetch('/api/settings', { cache: 'no-store' }),
                fetch('/api/inbox', { cache: 'no-store' })
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

    const [syncProgress, setSyncProgress] = useState<{ percentage: number, label: string } | null>(null);
    const [aiProgress, setAiProgress] = useState<{ percentage: number, label: string } | null>(null);

    useEffect(() => {
        fetchData();

        // Polling for progress
        const interval = setInterval(async () => {
            if (!isSyncing && !isAnalyzing) return; // Only poll if active

            try {
                const res = await fetch('/api/progress');
                const data = await res.json();

                if (data.success) {
                    if (data.sync) setSyncProgress(data.sync);
                    if (data.ai) setAiProgress(data.ai);
                }
            } catch (e) {
                console.error("Progress poll failed", e);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [fetchData, isSyncing, isAnalyzing]);

    const handleDropboxSync = async () => {
        setIsSyncing(true);

        const triggerScan = async () => {
            let hasMore = true;
            let currentCursor: string | undefined = undefined;
            let totalNewItems = 0;
            let accumulatedCount = 0;

            while (hasMore) {
                const apiResponse: Response = await fetch('/api/templates/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cursor: currentCursor, accumulatedCount })
                });

                const responseData: any = await apiResponse.json();
                if (!apiResponse.ok || !responseData.success) {
                    throw new Error(responseData.message || responseData.error || 'Chyba pri synchronizácii.');
                }

                hasMore = responseData.hasMore;
                currentCursor = responseData.cursor;
                totalNewItems += responseData.count || 0;
                accumulatedCount += responseData.scannedCount || 0;
            }

            return { message: `Sken dokončený. Nájdených ${totalNewItems} nových súborov.` };
        };

        toast.promise(triggerScan(), {
            loading: 'Prehľadávam Dropbox a sťahujem súbory...',
            success: (data) => {
                fetchData();
                setTimeout(() => setIsSyncing(false), 2000);
                return data.message;
            },
            error: (err: any) => {
                setIsSyncing(false);
                console.error('[SyncError]', err);
                return `Chyba: ${err.message}`;
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

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const groupedInbox = useMemo(() => {
        const groups: Record<string, InboxItem[]> = {};
        inboxItems.forEach(item => {
            const name = item.name;
            const withoutExt = name.substring(0, name.lastIndexOf('.')) || name;

            // Extract base name for v2 convention (ad_123_O_Name)
            let groupKey = withoutExt;
            const parts = withoutExt.split('_');
            if (parts[0] === 'ad' && parts.length >= 4) {
                groupKey = `ad_${parts[1]}_${parts[2]}_${parts[3]}`;
            }

            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(item);
        });
        return groups;
    }, [inboxItems]);

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
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
                {aiProgress && (
                    <div className="flex-1 max-w-xs mx-4">
                        <ProgressBar
                            progress={aiProgress.percentage}
                            label={aiProgress.label}
                            colorClass="bg-purple-600"
                        />
                    </div>
                )}
                <div className="h-4 w-[1px] bg-slate-100" />
                <div className="flex items-center gap-2">
                    {lastSync?.status === 'OK' ? (
                        <>
                            <CheckCircle2 size={14} className="text-green-500" />
                            <span className="text-green-600">Stav: OK</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={14} className="text-slate-400" />
                            <span className="text-slate-500">Pripravené</span>
                        </>
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
                        <>
                            <button
                                onClick={async () => {
                                    toast.promise(
                                        fetch('/api/inbox/aggregate', { method: 'POST' }).then(r => r.json()),
                                        {
                                            loading: 'Analyzujem a zlučujem súbory...',
                                            success: (data) => {
                                                fetchData();
                                                return data.message;
                                            },
                                            error: 'Chyba pri agregácii'
                                        }
                                    );
                                }}
                                disabled={inboxItems.length === 0}
                                className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200"
                            >
                                <Layers size={16} />
                                <span>Auto-Mapping</span>
                            </button>

                            <button
                                onClick={runAiAnalysis}
                                disabled={isAnalyzing || inboxItems.length === 0}
                                className={`flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-2xl text-sm font-bold hover:bg-purple-700 transition-all shadow-xl shadow-purple-200 ${isAnalyzing ? 'opacity-70' : ''}`}
                            >
                                {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                                <span>AI Triedenie</span>
                            </button>
                        </>
                    )}

                    <div className="flex flex-col w-full md:w-auto gap-2">
                        <button
                            onClick={handleDropboxSync}
                            disabled={isSyncing}
                            className={`flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                            <span>{isSyncing ? 'Skenujem...' : 'Skenovať Dropbox'}</span>
                        </button>
                        {isSyncing && syncProgress && (
                            <ProgressBar
                                progress={syncProgress.percentage}
                                label={syncProgress.label}
                                className="w-full md:w-48"
                                showPercentage={false}
                            />
                        )}
                    </div>
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
                                        ) : (template as any)._inboxPath ? (
                                            <ThumbnailViewer path={(template as any)._inboxPath} extension={(template as any)._inboxExt} className="w-full h-full object-cover" />
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
                                        <div className="flex items-baseline justify-between mb-1">
                                            <h3 className="text-lg font-black text-slate-900 truncate pr-2" title={template.alias || template.name || template.key}>
                                                {template.alias || template.name || template.key}
                                            </h3>
                                            {(template.alias || (template.name && template.name !== template.key)) && (
                                                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase shrink-0">
                                                    SKU: {template.key}
                                                </span>
                                            )}
                                        </div>
                                        {/* If it has variants, we can show a small badge */}
                                        <div className="flex items-center justify-between mb-6">
                                            <p className="text-xs font-medium text-slate-500 line-clamp-1 truncate w-full pr-2">
                                                {template.alias ? template.name : "Originál"}
                                            </p>
                                            {template.variants && template.variants.length > 0 && (
                                                <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded uppercase shrink-0">
                                                    +{template.variants.length}
                                                </span>
                                            )}
                                        </div>
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
                                    {Object.entries(groupedInbox).map(([groupKey, items]) => {
                                        const isExpanded = expandedGroups[groupKey];
                                        const hasMultiple = items.length > 1;

                                        return (
                                            <Fragment key={groupKey}>
                                                {/* Parent Group Row */}
                                                {hasMultiple && (
                                                    <tr className="bg-slate-50/50 border-b border-slate-100/50 hover:bg-slate-50 cursor-pointer" onClick={() => toggleGroup(groupKey)}>
                                                        <td colSpan={3} className="px-6 py-3">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-1.5 text-slate-400 bg-white shadow-sm rounded-md">
                                                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                    </div>
                                                                    <span className="font-bold text-slate-700 text-sm">Spojené dokumenty a návrhy: {groupKey}</span>
                                                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 font-bold rounded-full text-[10px] ml-2">
                                                                        {items.length} súborov
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); toast.info("Generovanie Multi-šablóny pridané čoskoro..."); }}
                                                                    className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm"
                                                                >
                                                                    Zlúčiť ako šablónu
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}

                                                {/* Children Rows */}
                                                {(hasMultiple ? isExpanded : true) && items.map((item) => {
                                                    const isAiTemplate = item.prediction?.category === 'TEMPLATE';
                                                    const isAiDoc = item.prediction?.category === 'DOCUMENT';
                                                    const isAiIgnore = item.prediction?.category === 'IGNORE';

                                                    return (
                                                        <tr key={item.id} className={`hover:bg-blue-50/30 transition-colors group ${hasMultiple ? 'bg-white' : ''}`}>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    {/* Use Thumbnail Viewer instead of icon */}
                                                                    <ThumbnailViewer path={item.path} extension={item.extension} />

                                                                    <div>
                                                                        <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                                                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1 max-w-[250px] truncate" title={item.path}>
                                                                            <FolderOpen size={10} className="shrink-0" />
                                                                            <span className="truncate">{item.path.replace(`/${item.name}`, '') || '/'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {item.prediction ? (
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className={`self-start px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${isAiTemplate ? 'bg-green-100 text-green-700' :
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
                                            </Fragment>
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
