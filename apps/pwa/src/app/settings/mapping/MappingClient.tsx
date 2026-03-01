"use client";

import { useState, useEffect } from "react";
import { Search, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface WebProduct {
    id: string;
    shopId: string | null;
    shopName: string | null;
    title: string;
    sku: string | null;
    imageUrl: string | null;
    templateId: string | null;
}

interface TemplateOption {
    id: string;
    key: string;
    name: string;
    status: string;
}

export default function MappingClient({
    initialProducts,
    templates
}: {
    initialProducts: WebProduct[],
    templates: TemplateOption[]
}) {
    const [products, setProducts] = useState(initialProducts);
    const [search, setSearch] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncLabel, setSyncLabel] = useState("");

    useEffect(() => {
        let eventSource: EventSource;
        if (isSyncing) {
            eventSource = new EventSource('/api/progress?client=mapping');
            eventSource.onmessage = (e) => {
                const data = JSON.parse(e.data);
                if (data.type === 'CATALOG_SYNC') {
                    setSyncProgress(data.progress);
                    setSyncLabel(data.message);
                    if (data.progress >= 100) {
                        setTimeout(() => setIsSyncing(false), 2000);
                        eventSource.close();
                    }
                }
            };
        }
        return () => {
            if (eventSource) eventSource.close();
        };
    }, [isSyncing]);

    const handleSync = async () => {
        setIsSyncing(true);
        setSyncProgress(0);
        setSyncLabel("Spúšťam synchronizáciu...");

        try {
            const res = await fetch('/api/woo/sync-catalog', { method: 'POST' });
            if (!res.ok) throw new Error("Sync failed");

            // Re-fetch to update visual list immediately
            toast.success("Katalóg bol úspešne synchronizovaný.");
            setTimeout(() => window.location.reload(), 1500);
        } catch (e: any) {
            toast.error(e.message || "Failed to sync catalog");
            setIsSyncing(false);
        }
    };

    const handleMappingChange = async (productId: string, newTemplateId: string) => {
        // Optimistic UI Update
        const previousVal = products.find(p => p.id === productId)?.templateId;
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, templateId: newTemplateId } : p));

        try {
            const res = await fetch('/api/woo/save-mapping', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ webProductId: productId, templateId: newTemplateId })
            });
            if (!res.ok) throw new Error("Failed to save mapping");
            toast.success("Mapovanie uložené");
        } catch (e: any) {
            toast.error("Chyba: " + e.message);
            // Revert on failure
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, templateId: previousVal || null } : p));
        }
    };

    const filteredProducts = products.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="relative w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Hľadať produkt podľa názvu alebo SKU..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                <div className="flex items-center gap-4">
                    {isSyncing && (
                        <div className="w-64">
                            <ProgressBar progress={syncProgress} label={syncLabel} className="text-xs" />
                        </div>
                    )}
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
                        Vynútiť aktualizáciu katalógu
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Zdroj</th>
                            <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produkt / Variant</th>
                            <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/3">Šablóna</th>
                            <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 align-middle">
                                    <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                                        {p.shopName || "Neznámy"}
                                    </span>
                                </td>
                                <td className="p-4 align-middle">
                                    <div className="flex items-center gap-4">
                                        {p.imageUrl ? (
                                            <img src={p.imageUrl} alt={p.title} className="w-12 h-12 object-cover rounded-lg border border-slate-200 shadow-sm" />
                                        ) : (
                                            <div className="w-12 h-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 text-xs">Bez obr.</div>
                                        )}
                                        <div>
                                            <div className="font-semibold text-slate-900 leading-tight">{p.title}</div>
                                            {p.sku && <div className="text-xs text-slate-500 font-mono mt-1">SKU: {p.sku}</div>}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 align-middle">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            list={`templates-${p.id}`}
                                            className="w-full text-sm border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                                            placeholder="-- Vyberte Šablónu --"
                                            defaultValue={templates.find(t => t.id === p.templateId)?.key || ""}
                                            onChange={(e) => {
                                                const selectedTemplate = templates.find(t => t.key === e.target.value);
                                                if (selectedTemplate) {
                                                    handleMappingChange(p.id, selectedTemplate.id);
                                                } else if (e.target.value === "") {
                                                    handleMappingChange(p.id, "");
                                                }
                                            }}
                                        />
                                        <datalist id={`templates-${p.id}`}>
                                            {templates.map(t => (
                                                <option key={t.id} value={t.key}>{t.name}</option>
                                            ))}
                                        </datalist>
                                    </div>
                                </td>
                                <td className="p-4 align-middle text-center">
                                    {p.templateId ? (
                                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-600" title="Spárované">
                                            <CheckCircle2 size={18} strokeWidth={2.5} />
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex-shrink-0" title="Chýba šablóna">
                                            <AlertCircle size={18} strokeWidth={2.5} />
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filteredProducts.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-500">Žiadne produkty nenašiel filter. Vynúťte synchronizáciu, ak máte prázdny katalóg.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
