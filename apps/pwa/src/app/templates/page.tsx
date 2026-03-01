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
    ChevronRight,
    Sparkles,
    AlertCircle,
    Zap
} from "lucide-react";
import { toast } from "sonner";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface Template {
    id: string;
    key: string;
    sku?: string | null;
    name: string;
    displayName?: string | null;
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

const ProductMatchRow = ({ wp, templates, onUpdate }: { wp: any, templates: Template[], onUpdate: (updated: any) => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [search, setSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Zatvoriť dropdown pri kliknutí mimo by bolo ideálne, tu použijeme onBlur trik na wrapperi
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsEditing(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredTemplates = useMemo(() => {
        if (!search) return templates.slice(0, 50); // Ukáž len prvých 50, ak nie je search, pre výkon
        const lower = search.toLowerCase();
        return templates.filter(t =>
            t.key.toLowerCase().includes(lower) ||
            t.name.toLowerCase().includes(lower) ||
            t.sku?.toLowerCase().includes(lower) ||
            t.displayName?.toLowerCase().includes(lower)
        ).slice(0, 50);
    }, [search, templates]);

    const handleSave = async (templateId: string | null) => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/products/map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: wp.id, templateId })
            });
            const data = await res.json();
            if (data.success) {
                onUpdate(data.product);
                toast.success(templateId ? 'Šablóna priradená.' : 'Párovanie zrušené.');
            } else {
                toast.error(data.error);
            }
        } catch (e: any) {
            toast.error("Chyba pri ukladaní.");
        } finally {
            setIsSaving(false);
            setIsEditing(false);
        }
    };

    // Extract thumbnail path from the active template's webProduct mapping
    const mainFile = wp.template?.files?.find((f: any) => f.type === 'MAIN') || wp.template?.files?.[0];

    return (
        <tr className="hover:bg-slate-50 transition-colors group">
            <td className="px-6 py-4">
                <p className="font-bold text-slate-900 text-sm">{wp.title}</p>
            </td>
            <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                {wp.sku || '-'}
            </td>
            <td className="px-6 py-4 relative">
                {wp.template ? (
                    <div className="flex items-center gap-3">
                        {mainFile && (
                            <div className="group/thumb relative">
                                <div className="w-8 h-8 rounded shrink-0 overflow-hidden border border-slate-200">
                                    <ThumbnailViewer path={mainFile.path} extension={mainFile.extension || '.psd'} className="w-full h-full" />
                                </div>
                                {/* Hover Preview */}
                                <div className="absolute left-10 top-1/2 -translate-y-1/2 z-50 hidden group-hover/thumb:block bg-white p-2 rounded-2xl shadow-2xl border border-slate-200 w-64 h-64 pointer-events-none">
                                    <ThumbnailViewer path={mainFile.path} extension={mainFile.extension || '.psd'} className="w-full h-full rounded-xl" />
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col">
                            <span className="font-bold text-blue-600 text-xs">{wp.template.displayName || wp.template.name}</span>
                            <span className="text-[10px] text-slate-400">{wp.template.key}</span>
                        </div>
                        <button
                            onClick={() => handleSave(null)}
                            disabled={isSaving}
                            className="ml-auto opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Zrušiť párovanie"
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                        </button>
                    </div>
                ) : (
                    <div className="relative" ref={wrapperRef}>
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-xs font-bold text-slate-400 hover:text-blue-600 border border-dashed border-slate-300 hover:border-blue-300 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-2"
                            >
                                <Search size={14} />
                                Vybrať šablónu
                            </button>
                        ) : (
                            <div className="absolute top-0 left-0 w-80 bg-white shadow-xl border border-slate-200 rounded-xl z-50 overflow-hidden">
                                <div className="p-2 border-b border-slate-100 flex items-center gap-2">
                                    <Search size={14} className="text-slate-400 ml-2" />
                                    <input
                                        autoFocus
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Hľadať šablónu (napr. 001)..."
                                        className="w-full text-sm outline-none px-2 py-1 bg-transparent"
                                    />
                                </div>
                                <div className="max-h-60 overflow-y-auto p-1">
                                    {filteredTemplates.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-slate-400">Nenašli sa žiadne šablóny.</div>
                                    ) : (
                                        filteredTemplates.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => handleSave(t.id)}
                                                className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg flex flex-col gap-0.5"
                                            >
                                                <span className="text-xs font-bold text-slate-900">{t.displayName || t.name}</span>
                                                <span className="text-[10px] text-slate-500">{t.key}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </td>
            <td className="px-6 py-4">
                {wp.templateId ? (
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-black uppercase flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            Spárované
                        </span>
                        {wp.matchConfidence && wp.matchConfidence < 1.0 && (
                            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 rounded font-bold" title="Umelá inteligencia si nie je 100% istá. Vizuálne overte.">
                                AI ({(wp.matchConfidence * 100).toFixed(0)}%)
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                        <AlertCircle size={12} />
                        Chýba Šablóna
                    </span>
                )}
            </td>
        </tr>
    );
}

export default function TemplatesPage() {
    const [activeTab, setActiveTab] = useState<'TEMPLATES' | 'INBOX' | 'MATCH'>('TEMPLATES');

    // Templates State
    const [templates, setTemplates] = useState<Template[]>([]);

    // Inbox State
    const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [inboxFilter, setInboxFilter] = useState<'ALL' | 'PSD' | 'AI' | 'IMAGES' | 'OTHER'>('ALL');

    // Web Match State
    const [webProducts, setWebProducts] = useState<any[]>([]);
    const [isMatching, setIsMatching] = useState(false);
    const [matchProgress, setMatchProgress] = useState<{ percentage: number, label: string } | null>(null);

    // Common State
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<{ date: string; status: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isBulkMapping, setIsBulkMapping] = useState(false);
    const [bulkMapProgress, setBulkMapProgress] = useState<{ percentage: number, label: string, current?: number, total?: number, status?: string } | null>(null);
    const [syncProgress, setSyncProgress] = useState<{ percentage: number, label: string } | null>(null);
    const [aiProgress, setAiProgress] = useState<{ percentage: number, label: string } | null>(null);

    // Multi-selection state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isBulkClassifying, setIsBulkClassifying] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [templatesRes, settingsRes, inboxRes, matchRes] = await Promise.all([
                fetch('/api/templates', { cache: 'no-store' }),
                fetch('/api/settings', { cache: 'no-store' }),
                fetch('/api/inbox', { cache: 'no-store' }),
                fetch('/api/templates/match-products?action=list', { cache: 'no-store' })
            ]);

            const templatesData = await templatesRes.json();
            const settingsData = await settingsRes.json();
            const inboxData = await inboxRes.json();
            const matchData = await matchRes.json();

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

            if (matchData.success) {
                setWebProducts(matchData.products);
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

        // Polling for progress
        const interval = setInterval(async () => {
            // Poll if anything is active OR if we have an active bulk mapping status
            if (!isSyncing && !isAnalyzing && !isBulkMapping && !isMatching) return;

            try {
                const res = await fetch('/api/progress');
                const data = await res.json();

                if (data.success) {
                    if (data.sync) setSyncProgress(data.sync);
                    if (data.ai) setAiProgress(data.ai);
                    if (data.aiMatch) setMatchProgress(data.aiMatch);
                    if (data.bulkMap) {
                        setBulkMapProgress(data.bulkMap);
                        if (data.bulkMap.status === 'COMPLETED') {
                            setIsBulkMapping(false);
                            fetchData();
                        }
                    }
                }
            } catch (e) {
                console.error("Progress poll failed", e);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [fetchData, isSyncing, isAnalyzing, isBulkMapping, isMatching]);

    const handleBulkMapAI = async () => {
        setIsBulkMapping(true);
        setBulkMapProgress({ percentage: 0, label: "Pripravujem hromadné AI mapovanie...", current: 0, total: 0 });

        try {
            const res = await fetch('/api/templates/bulk-map', { method: 'POST' });

            if (!res.body) throw new Error("No stream content");
            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.replace('data: ', ''));

                            if (data.type === 'START') {
                                setBulkMapProgress(prev => ({ ...prev!, total: data.total }));
                            } else if (data.type === 'PROGRESS') {
                                setBulkMapProgress(prev => ({
                                    ...prev!,
                                    current: data.current,
                                    total: data.total,
                                    label: `Mapujem ${data.name}...`,
                                    percentage: (data.current / (data.total || 1)) * 100
                                }));
                            } else if (data.type === 'DONE') {
                                toast.success(`Hromadné mapovanie dokončené! Spracovaných ${data.count} šablón.`);
                                setIsBulkMapping(false);
                                fetchData();
                            } else if (data.type === 'ERROR') {
                                toast.error(data.error);
                                setIsBulkMapping(false);
                            }
                        } catch (e) {
                            console.error("Error parsing stream chunk", e);
                        }
                    }
                }
            }
        } catch (e: any) {
            console.error("Bulk map error:", e);
            toast.error("Chyba hromadného mapovania.");
            setIsBulkMapping(false);
        }
    };

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
        setAiProgress({ percentage: 0, label: "Pripravujem AI analýzu..." });

        const BATCH_SIZE = 20;
        let successCount = 0;
        let processedCount = 0;

        try {
            for (let i = 0; i < inboxItems.length; i += BATCH_SIZE) {
                const chunk = inboxItems.slice(i, i + BATCH_SIZE);
                setAiProgress({
                    percentage: Math.round((processedCount / inboxItems.length) * 100),
                    label: `Analyzujem dávku ${processedCount + 1}-${processedCount + chunk.length} z ${inboxItems.length}...`
                });

                try {
                    const res = await fetch('/api/inbox/analyze', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ items: chunk })
                    });

                    const data = await res.json().catch(() => ({ error: "Nečitateľná odpoveď (Timeout)" }));

                    if (data.success) {
                        successCount += chunk.length;
                    } else {
                        console.error(`AI Chunk Error:`, data.error);
                        toast.error(`Zlyhanie pri dávke: ${data.error || "Neznáma chyba"}`);
                    }
                } catch (chunkErr: any) {
                    console.error("Chunk Network Error:", chunkErr);
                    toast.error(`Sieťová chyba pri dávke obídená: ${chunkErr.message}`);
                }

                processedCount += chunk.length;
                // Obnova databázy v UI po každej úspešnej dávke
                await fetchData();
            }

            toast.success(`AI analýza dokončená! Skontrolovaných ${successCount}/${inboxItems.length} súborov.`);
        } catch (e: any) {
            console.error("[runAiAnalysis] Fatal Error:", e);
            toast.error(`Fatálna chyba AI procesu: ${e.message}`);
        } finally {
            setIsAnalyzing(false);
            setAiProgress(null);
        }
    };

    const handleClassify = async (id: string, action: 'TEMPLATE' | 'DOCUMENT' | 'IGNORE') => {
        // Optimistic update
        setInboxItems(prev => prev.filter(i => i.id !== id));
        setSelectedItems(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });

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
                fetchData();
            }

        } catch (e) {
            toast.error("Nepodarilo sa uložiť akciu.");
            fetchData(); // Revert
        }
    };

    const handleBulkClassify = async (action: 'TEMPLATE' | 'DOCUMENT' | 'IGNORE') => {
        if (selectedItems.size === 0) return;

        setIsBulkClassifying(true);
        const ids = Array.from(selectedItems);

        toast.promise(
            (async () => {
                const res = await fetch('/api/inbox/bulk-classify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids, action })
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.error || "Chyba API");
                return data;
            })(),
            {
                loading: `Spracovávam ${selectedItems.size} súborov...`,
                success: (data) => {
                    setSelectedItems(new Set());
                    fetchData();
                    setIsBulkClassifying(false);
                    return `Úspešne spracovaných ${ids.length} súborov.`;
                },
                error: (err) => {
                    setIsBulkClassifying(false);
                    return `Chyba: ${err.message}`;
                }
            }
        );
    };

    const toggleSelectItem = (id: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const [isBulkApproving, setIsBulkApproving] = useState(false);

    const handleBulkApproveAI = async () => {
        setIsBulkApproving(true);
        setAiProgress({ percentage: 0, label: 'Pripravujem hromadné schválenie...' });

        try {
            const res = await fetch('/api/inbox/bulk-approve', { method: 'POST' });
            if (!res.body) throw new Error("Server nevrátil žiadne dáta.");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        if (data.type === 'progress') {
                            setAiProgress({ percentage: data.percentage, label: data.message });
                        } else if (data.type === 'done') {
                            toast.success(`Hromadné schválenie dokončené: ${data.processed} súborov.`);
                        } else if (data.type === 'error') {
                            toast.error(`Chyba: ${data.message}`);
                        }
                    } catch (e) {
                        console.error("Error parsing stream line:", e);
                    }
                }
            }

            fetchData();
        } catch (error: any) {
            console.error("[BulkApprove] Frontend Error:", error);
            toast.error(`Nepodarilo sa spustiť hromadné schválenie: ${error.message}`);
        } finally {
            setIsBulkApproving(false);
            setTimeout(() => setAiProgress(null), 2000);
        }
    };

    const filteredInboxItems = useMemo(() => {
        if (inboxFilter === 'ALL') return inboxItems;
        return inboxItems.filter(item => {
            const ext = item.extension.toLowerCase();
            if (inboxFilter === 'PSD') return ext === '.psd' || ext === '.psdt' || ext === '.psb';
            if (inboxFilter === 'AI') return ext === '.ai';
            if (inboxFilter === 'IMAGES') return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
            return !['.psd', '.psdt', '.psb', '.ai', '.png', '.jpg', '.jpeg', '.webp'].includes(ext);
        });
    }, [inboxItems, inboxFilter]);

    const toggleSelectAll = () => {
        if (selectedItems.size === filteredInboxItems.length && filteredInboxItems.length > 0) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(filteredInboxItems.map(i => i.id)));
        }
    };

    const handleBulkMapping = async () => {
        setIsBulkMapping(true);
        setBulkMapProgress({ percentage: 0, label: 'ŠTARTUJAM...', status: 'RUNNING' });

        try {
            const res = await fetch('/api/templates/bulk-process', { method: 'POST' });
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || 'Chyba pri štarte hromadného procesu.');
            }

            if (data.message === 'No templates need mapping') {
                toast.info("Všetky aktívne šablóny sú už namapované.");
                setIsBulkMapping(false);
                setBulkMapProgress(null);
                return;
            }

            toast.success(`Hromadný proces spustený pre ${data.total} šablón.`);
        } catch (e: any) {
            toast.error(e.message || "Nepodarilo sa spustiť hromadné mapovanie.");
            setIsBulkMapping(false);
            setBulkMapProgress(null);
        }
    };

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const groupedInbox = useMemo(() => {
        const groups: Record<string, InboxItem[]> = {};
        filteredInboxItems.forEach(item => {
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
    }, [filteredInboxItems]);

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <AppHeader title="Katalóg Šablón" />

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Global Status Bar */}
                <div className="flex items-center gap-6 mb-8 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
                    <div className="flex items-center gap-3">
                        <Clock size={16} className="text-slate-400" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Posledná synchronizácia</span>
                            <span className="text-xs font-bold text-slate-700 mt-1">{lastSync?.date ? new Date(lastSync.date).toLocaleString('sk-SK') : 'Nikdy'}</span>
                        </div>
                    </div>
                    {(isBulkMapping || isSyncing || isAnalyzing || isMatching) && (
                        <div className="flex-grow min-w-[200px]">
                            {isBulkMapping && bulkMapProgress && (
                                <ProgressBar
                                    progress={bulkMapProgress.percentage}
                                    label={bulkMapProgress.label || "Hromadné mapovanie..."}
                                    className="w-full"
                                    colorClass="bg-gradient-to-r from-purple-600 to-indigo-600"
                                />
                            )}
                            {isSyncing && syncProgress && (
                                <ProgressBar
                                    progress={syncProgress.percentage}
                                    label={syncProgress.label || "Synchronizujem..."}
                                    className="w-full"
                                    colorClass="bg-blue-600"
                                />
                            )}
                            {isAnalyzing && aiProgress && (
                                <ProgressBar
                                    progress={aiProgress.percentage}
                                    label={aiProgress.label || "AI analýza..."}
                                    className="w-full"
                                    colorClass="bg-purple-600"
                                />
                            )}
                            {isMatching && matchProgress && (
                                <ProgressBar
                                    progress={matchProgress.percentage}
                                    label={matchProgress.label || "Párovanie..."}
                                    className="w-full"
                                    colorClass="bg-indigo-600"
                                />
                            )}
                        </div>
                    )}
                    <div className="h-4 w-[1px] bg-slate-100 shrink-0" />
                    <div className="flex items-center gap-2 shrink-0">
                        {lastSync?.status === 'OK' ? (
                            <>
                                <CheckCircle2 size={14} className="text-green-500" />
                                <span className="text-green-600 text-xs font-bold uppercase tracking-widest">Stav: OK</span>
                            </>
                        ) : (
                            <>
                                <Clock size={14} className="text-slate-400" />
                                <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Pripravené</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Tabs & Controls Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
                    {/* Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0">
                        <button
                            onClick={() => setActiveTab('TEMPLATES')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'TEMPLATES' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Layers size={18} />
                            <span>Šablóny</span>
                            <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-lg text-[10px] ml-1">{templates.length}</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('INBOX')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'INBOX' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Inbox size={18} />
                            <span>Inbox</span>
                            {inboxItems.length > 0 && (
                                <span className="bg-red-500 text-white px-2 py-0.5 rounded-lg text-[10px] ml-1 animate-pulse">{inboxItems.length}</span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('MATCH')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'MATCH' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Sparkles size={18} />
                            <span>Párovanie</span>
                        </button>
                    </div>

                    {/* Context Actions */}
                    <div className="flex items-center gap-3 w-full lg:w-auto">
                        {activeTab === 'TEMPLATES' && (
                            <div className="flex items-center gap-4 w-full justify-end">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm shrink-0">
                                    <div className="flex items-center gap-1.5 min-w-[40px]">
                                        <div className={`w-2.5 h-2.5 rounded-full ${templates.filter(t => t.status === 'ACTIVE').length > 0 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-green-100'}`}></div>
                                        <span className="text-[10px] font-black text-slate-700">{templates.filter(t => t.status === 'ACTIVE').length}</span>
                                    </div>
                                    <div className="w-[1px] h-3 bg-slate-200" />
                                    <div className="flex items-center gap-1.5 min-w-[40px]">
                                        <div className={`w-2.5 h-2.5 rounded-full ${templates.filter(t => t.status === 'NEEDS_REVIEW').length > 0 ? 'bg-yellow-400' : 'bg-yellow-100'}`}></div>
                                        <span className="text-[10px] font-black text-slate-700">{templates.filter(t => t.status === 'NEEDS_REVIEW').length}</span>
                                    </div>
                                    <div className="w-[1px] h-3 bg-slate-200" />
                                    <div className="flex items-center gap-1.5 min-w-[40px]">
                                        <div className={`w-2.5 h-2.5 rounded-full ${templates.filter(t => t.status === 'PENDING_MAPPING' || !t.status).length > 0 ? 'bg-red-500' : 'bg-red-100'}`}></div>
                                        <span className="text-[10px] font-black text-slate-700">{templates.filter(t => t.status === 'PENDING_MAPPING' || !t.status).length}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleBulkMapAI}
                                    disabled={isBulkMapping}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl text-xs font-bold hover:scale-[1.02] transition-all shadow-lg shadow-purple-200 active:scale-[0.98] disabled:opacity-50"
                                >
                                    {isBulkMapping ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} className="fill-white" />}
                                    <span>Hromadné AI Mapovanie</span>
                                </button>
                            </div>
                        )}

                        {activeTab === 'INBOX' && (
                            <div className="flex items-center gap-3 w-full justify-end">
                                {selectedItems.size > 0 && (
                                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-right-1">
                                        <span className="text-[10px] font-black text-blue-700 mr-2">{selectedItems.size} VYBRANÝCH</span>
                                        <button onClick={() => handleBulkClassify('TEMPLATE')} className="px-3 py-1 bg-green-600 text-white rounded-lg text-[10px] font-bold hover:bg-green-700">Šablóna</button>
                                        <button onClick={() => setSelectedItems(new Set())} className="text-[10px] font-bold text-blue-500 px-2">Zrušiť</button>
                                    </div>
                                )}
                                <button
                                    onClick={handleDropboxSync}
                                    disabled={isSyncing}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                                >
                                    {isSyncing ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                    <span>Skenovať Dropbox</span>
                                </button>
                                <button
                                    onClick={runAiAnalysis}
                                    disabled={isAnalyzing || inboxItems.length === 0}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-2xl text-xs font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-50"
                                >
                                    {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                                    <span>AI Triedenie</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="animate-in fade-in duration-700">
                    {activeTab === 'TEMPLATES' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {isLoading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="bg-white rounded-[32px] border border-slate-100 p-6 h-64 animate-pulse" />
                                ))
                            ) : templates.length === 0 ? (
                                <div className="col-span-full py-32 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
                                    <Layers size={48} className="mx-auto text-slate-200 mb-4" />
                                    <h3 className="text-xl font-bold text-slate-400">Žiadne aktívne šablóny</h3>
                                    <p className="text-slate-400 mt-2">Pridajte súbory z Inboxu alebo spustite skenovanie Dropboxu.</p>
                                </div>
                            ) : (
                                templates.map((template) => (
                                    <Link href={`/templates/${encodeURIComponent(template.key)}`} key={template.id} className="group">
                                        <div className={`cursor-pointer bg-white rounded-[32px] border transition-all flex flex-col h-full overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 ${template.isVerified ? 'border-green-200 ring-1 ring-green-100' : 'border-slate-100'}`}>
                                            <div className="h-48 bg-slate-50 w-full relative border-b border-slate-100">
                                                {template.imageUrl ? (
                                                    <img src={template.imageUrl} alt={template.name} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-200 group-hover:text-blue-200 transition-colors">
                                                        <ImageIcon size={48} strokeWidth={1} />
                                                    </div>
                                                )}
                                                {/* Badges */}
                                                <div className="absolute top-4 right-4 flex flex-col gap-2">
                                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md bg-white/80 border text-[10px] font-black uppercase tracking-widest shadow-lg">
                                                        <div className={`w-2 h-2 rounded-full ${template.status === 'ACTIVE' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                                                            (template.status === 'NEEDS_REVIEW' ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]')
                                                            }`}></div>
                                                        <span className="text-slate-700">{template.status || 'DRAFT'}</span>
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-4 left-4 flex flex-col gap-1.5">
                                                    {template.sku && (
                                                        <span className="text-[10px] font-black text-white bg-purple-600/90 px-2.5 py-1 rounded-lg shadow-lg uppercase tracking-wider backdrop-blur-sm border border-white/20">{template.sku}</span>
                                                    )}
                                                    <span className="text-[11px] font-bold text-white bg-slate-900/60 px-2.5 py-1 rounded-lg backdrop-blur-md border border-white/10 uppercase tracking-widest">{template.key}</span>
                                                </div>
                                            </div>
                                            <div className="p-6 flex-grow flex flex-col">
                                                <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-lg line-clamp-1">{template.displayName || template.name}</h3>
                                                <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-50">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Mapovanie</span>
                                                        <span className="text-xs font-bold text-slate-700">{template.mappedPaths || 0} polí</span>
                                                    </div>
                                                    <div className={`p-2 rounded-xl transition-all ${template.isVerified ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                                        {template.isVerified ? <CheckCircle2 size={18} /> : <Layers size={18} />}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'INBOX' && (
                        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                            {inboxItems.length === 0 ? (
                                <div className="py-32 text-center">
                                    <Inbox size={48} className="mx-auto text-slate-200 mb-4" />
                                    <h3 className="text-xl font-bold text-slate-400">Váš Inbox je prázdny</h3>
                                    <p className="text-slate-400 mt-2">Spustite skenovanie Dropboxu pre načítanie nových súborov.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-5 w-12 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                                        checked={inboxItems.length > 0 && selectedItems.size === inboxItems.length}
                                                        onChange={(e) => e.target.checked ? setSelectedItems(new Set(inboxItems.map(i => i.id))) : setSelectedItems(new Set())}
                                                    />
                                                </th>
                                                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Súbor</th>
                                                <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Analýza</th>
                                                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Akcie</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {inboxItems.map((item) => {
                                                const isAiDoc = item.prediction?.category === 'DOCUMENT';
                                                const isAiIgnore = item.prediction?.category === 'IGNORE';

                                                return (
                                                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors group ${selectedItems.has(item.id) ? 'bg-blue-50/50' : ''}`}>
                                                        <td className="px-6 py-4 text-center">
                                                            <input
                                                                type="checkbox"
                                                                className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                                                checked={selectedItems.has(item.id)}
                                                                onChange={() => toggleSelectItem(item.id)}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-4">
                                                                <ThumbnailViewer path={item.path} extension={item.extension} />
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-bold text-slate-900 text-sm truncate max-w-md">{item.name}</span>
                                                                    <span className="text-[10px] text-slate-400 font-mono mt-1 opacity-60 truncate">{item.path}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-10 py-4">
                                                            {item.prediction ? (
                                                                <div className="flex flex-col gap-1">
                                                                    <span className={`self-start px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${item.prediction.category === 'TEMPLATE' ? 'bg-green-100 text-green-700' :
                                                                        item.prediction.category === 'DOCUMENT' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                                                        }`}>
                                                                        {item.prediction.category}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 italic max-w-sm">{item.prediction.reasoning}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300 text-xs italic">Čaká na analýzu...</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleClassify(item.id, 'TEMPLATE')}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-xl text-[10px] font-bold hover:bg-green-600 hover:text-white transition-all"
                                                                >
                                                                    <CheckCircle2 size={14} />
                                                                    Schváliť
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
                                                                    <Trash2 size={18} />
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

                    {activeTab === 'MATCH' && (
                        <div className="space-y-6">
                            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                                        <Sparkles size={32} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight">AI Matching Produktov</h2>
                                        <p className="text-slate-500 mt-1">Automaticky prepojíme grafické šablóny s vašimi produktmi na e-shope.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={async () => {
                                        setIsMatching(true);
                                        setMatchProgress({ percentage: 0, label: 'Začínam párovanie...' });
                                        try {
                                            const res = await fetch('/api/templates/match-products', { method: 'POST' });
                                            if (!res.body) throw new Error("No stream content");
                                            const reader = res.body.getReader();
                                            const decoder = new TextDecoder();
                                            let buffer = '';
                                            while (true) {
                                                const { done, value } = await reader.read();
                                                if (done) break;
                                                buffer += decoder.decode(value, { stream: true });
                                                const lines = buffer.split('\n');
                                                buffer = lines.pop() || '';
                                                for (const line of lines) {
                                                    if (line.trim()) {
                                                        const event = JSON.parse(line);
                                                        if (event.type === 'progress') setMatchProgress({ percentage: event.percentage, label: event.message });
                                                        else if (event.type === 'done') toast.success(`Párovanie dokončené!`);
                                                    }
                                                }
                                            }
                                            fetchData();
                                        } catch (e) {
                                            toast.error("Zlyhanie párovania.");
                                        } finally {
                                            setIsMatching(false);
                                        }
                                    }}
                                    disabled={isMatching}
                                    className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-[24px] font-bold hover:bg-black transition-all shadow-xl active:scale-95 disabled:opacity-50"
                                >
                                    {isMatching ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} className="fill-white" />}
                                    <span>Spustiť AI Matcher</span>
                                </button>
                            </div>

                            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-shop Produkt</th>
                                            <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">SKU</th>
                                            <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priradená Šablóna</th>
                                            <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {webProducts.length > 0 ? (
                                            webProducts.map((wp) => (
                                                <ProductMatchRow key={wp.id} wp={wp} templates={templates} onUpdate={fetchData} />
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="text-center p-8 text-slate-500 italic">
                                                    Zatiaľ neboli stiahnuté žiadne produkty z e-shopu. Použite sekciu Nastavenia.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
