"use client";

import { useState, useRef, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import Link from "next/link";
import {
    Layers,
    Search,
    Plus,
    MoreHorizontal,
    FolderOpen,
    FileText,
    RefreshCw,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2
} from "lucide-react";
import Papa from "papaparse";
import { extractTemplateKey } from "@/lib/parser";
import { toast } from "sonner";

interface Template {
    key: string;
    name: string;
    mappedPaths: number;
    status: string;
    matched: boolean;
    matchCount?: number;
}

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<{ date: string; status: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = async () => {
        try {
            const [templatesRes, settingsRes] = await Promise.all([
                fetch('/api/templates'),
                fetch('/api/settings')
            ]);

            const templatesData = await templatesRes.json();
            const settingsData = await settingsRes.json();

            if (templatesData.success) {
                setTemplates(templatesData.templates);
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
        const promise = fetch('/api/templates/sync', { method: 'POST' });

        toast.promise(promise, {
            loading: 'Pripájam sa k Dropboxu a hľadám šablóny...',
            success: async (res) => {
                setIsSyncing(false);
                if (!res.ok) {
                    const text = await res.text();
                    let errorMsg = `Server error ${res.status}`;
                    try {
                        const data = JSON.parse(text);
                        errorMsg = data.message || errorMsg;
                    } catch (e) { }
                    throw new Error(errorMsg);
                }

                const data = await res.json();
                if (data.success) {
                    fetchData();
                    return data.message || `Úspešne synchronizovaných ${data.count} šablón.`;
                } else {
                    throw new Error(data.message || 'Chyba pri synchronizácii');
                }
            },
            error: (err: any) => {
                setIsSyncing(false);
                console.error('[DropboxSyncToast] Error details:', err);
                const message = err.message || (typeof err === 'string' ? err : 'Zlyhalo sieťové spojenie alebo server neodpovedá JSON-om.');
                return `CHYBA: ${message}`;
            }
        });
    };

    const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data as any[];
                const foundKeys: Record<string, number> = {};

                rows.forEach(row => {
                    Object.values(row).forEach(val => {
                        if (typeof val === 'string') {
                            const key = extractTemplateKey(val);
                            if (key) {
                                foundKeys[key] = (foundKeys[key] || 0) + 1;
                            }
                        }
                    });
                });

                const updatedTemplates = templates.map((t: Template) => ({
                    ...t,
                    matched: !!foundKeys[t.key],
                    matchCount: foundKeys[t.key] || 0
                })).sort((a: Template, b: Template) => (b.matchCount || 0) - (a.matchCount || 0));

                setTemplates(updatedTemplates);
                toast.success('Párovanie z CSV dokončené.');
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
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleCsvUpload}
                        className="hidden"
                        accept=".csv"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <FileText size={18} />
                        <span>Napárovať CSV</span>
                    </button>

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 h-48 animate-pulse">
                            <div className="w-12 h-12 bg-slate-50 rounded-2xl mb-4" />
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
                            <div className={`cursor-pointer bg-white rounded-3xl border transition-all group p-6 relative overflow-hidden h-full ${template.matched ? 'border-blue-200 shadow-blue-100 ring-1 ring-blue-100' : 'border-slate-100 shadow-sm hover:shadow-md'}`}>
                                {template.matched && (
                                    <div className="absolute top-0 right-0 px-3 py-1 bg-blue-500 text-white text-[8px] font-black uppercase tracking-tighter rounded-bl-xl shadow-sm">
                                        {template.matchCount} ks v CSV
                                    </div>
                                )}

                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-2xl transition-colors ${template.matched ? 'bg-blue-50' : 'bg-slate-50 group-hover:bg-blue-50'}`}>
                                        <Layers className={`${template.matched ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-500'}`} size={24} />
                                    </div>
                                    <button className="p-2 text-slate-400 hover:text-slate-600">
                                        <MoreHorizontal size={20} />
                                    </button>
                                </div>

                                <h3 className="text-lg font-black text-slate-900 mb-1">{template.key}</h3>
                                <p className="text-sm font-medium text-slate-500 mb-6">{template.name}</p>

                                <div className="flex items-center justify-between pt-6 border-t border-slate-50 mt-auto">
                                    <div className="flex items-center gap-2">
                                        <FolderOpen size={14} className="text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600">{template.mappedPaths} polí namapovaných</span>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${template.status === 'ACTIVE'
                                        ? 'bg-green-100 text-green-600'
                                        : 'bg-red-100 text-red-600'
                                        }`}>
                                        {template.status === 'ACTIVE' ? 'Aktívna' : 'Bez manifestu'}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
