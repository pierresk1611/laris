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
    FileText
} from "lucide-react";
import Papa from "papaparse";
import { extractTemplateKey } from "@/lib/parser";

interface Template {
    key: string;
    name: string;
    mappedPaths: number;
    status: string;
    matched: boolean;
    matchCount?: number;
}

const initialTemplates: Template[] = [
    { key: "JSO 15", name: "Jubilejná Svadobná 15", mappedPaths: 12, status: "ACTIVE", matched: false },
    { key: "VSO 02", name: "Vianočná Súprava 02", mappedPaths: 8, status: "ACTIVE", matched: false },
    { key: "JSO 22", name: "Jubilejná Svadobná 22", mappedPaths: 0, status: "MISSING_MANIFEST", matched: false },
];

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>(initialTemplates);
    const [isSyncing, setIsSyncing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDropboxSync = async () => {
        setIsSyncing(true);
        try {
            // In a real scenario, this would call our /api/dropbox route
            const response = await fetch('/api/dropbox');
            const data = await response.json();
            console.log('Dropbox sync response:', data);

            // For now, we simulate finding "new" templates if they weren't in initial list
            // or just refreshing the status
            setTimeout(() => {
                setIsSyncing(false);
            }, 1500);
        } catch (error) {
            console.error('Dropbox sync failed:', error);
            setIsSyncing(false);
        }
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
                    // Search all columns for pattern JSO XX / VSO XX
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
            }
        });
    };

    return (
        <div>
            <AppHeader title="Šablóny" />

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
                        <Plus size={18} />
                        <span>{isSyncing ? 'Synchronizujem...' : 'Import z Dropboxu'}</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {templates.map((template: Template) => (
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
                ))}
            </div>
        </div>
    );
}
