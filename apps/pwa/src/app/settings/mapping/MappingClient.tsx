"use client";

import { useState, useEffect, useRef } from "react";
import { Search, RefreshCw, CheckCircle2, AlertCircle, Edit2, X } from "lucide-react";
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
    imageUrl: string | null;
}

function EditableSku({
    initialSku,
    productId,
    onSave
}: {
    initialSku: string | null;
    productId: string;
    onSave: (id: string, newSku: string) => Promise<void>
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(initialSku || "");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (value.trim() === (initialSku || "").trim()) {
            setIsEditing(false);
            return;
        }
        setSaving(true);
        try {
            await onSave(productId, value.trim());
            setIsEditing(false);
            toast.success("SKU bolo upravené");
        } catch (e: any) {
            toast.error("Chyba: " + e.message);
            setValue(initialSku || "");
        } finally {
            setSaving(false);
        }
    };

    if (!isEditing) {
        return (
            <div
                className={`text-xs font-mono mt-1 w-fit group cursor-pointer flex items-center gap-1 ${initialSku ? 'text-slate-500' : 'text-slate-300 italic'}`}
                onClick={() => setIsEditing(true)}
            >
                <span className="px-1.5 py-0.5 rounded border border-transparent group-hover:bg-slate-100 group-hover:border-slate-200 transition-colors shadow-sm bg-white">
                    SKU: {initialSku || "Nepriradené (klikni a uprav)"}
                </span>
                <Edit2 size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-slate-400 font-mono">SKU:</span>
            <input
                type="text"
                autoFocus
                className="text-xs font-mono px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-32 shadow-sm"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                onBlur={handleSave}
                disabled={saving}
            />
            {saving && <RefreshCw size={12} className="animate-spin text-blue-500" />}
        </div>
    );
}

function TemplateCombobox({
    value,
    templates,
    onChange
}: {
    value: string | null;
    templates: TemplateOption[];
    onChange: (id: string | null) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedTemplate = value ? templates.find(t => t.id === value) : null;

    const filtered = templates.filter(t =>
        (t.key + " " + t.name).toLowerCase().includes(search.toLowerCase())
    ).slice(0, 50);

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div
                className={`w-full text-sm border ${selectedTemplate ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'} rounded-xl px-3 py-2 cursor-text focus-within:ring-2 focus-within:ring-blue-500 flex items-center min-h-[42px] transition-colors`}
                onClick={() => setIsOpen(true)}
            >
                {!isOpen && selectedTemplate ? (
                    <div className="flex items-center gap-3 w-full">
                        {selectedTemplate.imageUrl ? (
                            <img src={selectedTemplate.imageUrl} alt="" className="w-8 h-8 object-cover rounded-lg shadow-sm border border-slate-200" />
                        ) : (
                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-[8px] text-slate-400 border border-slate-200">Bez obr.</div>
                        )}
                        <span className="font-semibold text-slate-700 truncate">{selectedTemplate.key} <span className="text-slate-400 font-normal hidden xl:inline">- {selectedTemplate.name}</span></span>
                    </div>
                ) : (
                    <input
                        type="text"
                        placeholder={selectedTemplate ? `${selectedTemplate.key} (kliknite pre zmenu)` : "Hľadať šablónu (napr. 2025)..."}
                        autoFocus={isOpen}
                        className="w-full focus:outline-none bg-transparent font-medium"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setIsOpen(true);
                        }}
                    />
                )}
            </div>

            {isOpen && (
                <div className="absolute z-50 w-[450px] mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-80 overflow-y-auto left-0 origin-top animate-in fade-in zoom-in-95 duration-100">
                    {filtered.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500 text-center flex flex-col items-center gap-2">
                            <AlertCircle size={20} className="text-slate-300" />
                            Pre <span className="font-bold">"{search}"</span> sa nenašla žiadna šablóna.
                        </div>
                    ) : (
                        filtered.map(t => (
                            <div
                                key={t.id}
                                className={`p-3 flex items-center gap-4 cursor-pointer hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 ${t.id === value ? 'bg-blue-50' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange(t.id);
                                    setIsOpen(false);
                                    setSearch("");
                                }}
                            >
                                {t.imageUrl ? (
                                    <img src={t.imageUrl} alt="" className="w-12 h-12 object-cover rounded-xl border border-slate-200 shadow-sm flex-shrink-0" />
                                ) : (
                                    <div className="w-12 h-12 bg-slate-100 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center text-[10px] text-slate-400 flex-shrink-0">Náhľad<br />chýba</div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-black text-slate-900 text-sm tracking-tight">{t.key}</div>
                                    <div className="truncate text-xs text-slate-500 mt-0.5">{t.name}</div>
                                </div>
                                {t.id === value && <CheckCircle2 size={18} className="text-emerald-500 mr-2" />}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
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
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Advanced search: Prioritize SKU matches first in the UX (just visual sorting/filtering)
    const filteredProducts = products.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
    ).sort((a, b) => {
        if (search) {
            const aSkuMatch = a.sku?.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            const bSkuMatch = b.sku?.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            if (aSkuMatch !== bSkuMatch) return bSkuMatch - aSkuMatch;
        }
        return 0;
    });

    const isAllSelected = filteredProducts.length > 0 && selectedIds.size === filteredProducts.length;

    const handleToggleAll = () => {
        if (isAllSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredProducts.map(p => p.id)));
        }
    };

    const handleToggleOne = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

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
        setSyncLabel("Spúšťam stiahnutie katalógu a variácií...");

        try {
            const res = await fetch('/api/woo/sync-catalog', { method: 'POST' });
            if (!res.ok) throw new Error("Sync failed");
            toast.success("Katalóg bol úspešne synchronizovaný.");
            setTimeout(() => window.location.reload(), 1500);
        } catch (e: any) {
            toast.error(e.message || "Failed to sync catalog");
            setIsSyncing(false);
        }
    };

    const handleSkuSave = async (productId: string, newSku: string) => {
        const res = await fetch('/api/woo/save-mapping', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webProductId: productId, sku: newSku })
        });
        if (!res.ok) throw new Error("Server error");
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, sku: newSku } : p));
    };

    const handleMappingChange = async (productId: string, newTemplateId: string | null) => {
        const previousVal = products.find(p => p.id === productId)?.templateId;
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, templateId: newTemplateId } : p));

        try {
            const res = await fetch('/api/woo/save-mapping', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ webProductId: productId, templateId: newTemplateId }) // newTemplateId can be null for Undo
            });
            if (!res.ok) throw new Error("Failed to save mapping");
            if (newTemplateId) toast.success("Mapovanie úspešne uložené");
            else toast.success("Mapovanie bolo zmazané");

            // Unselect if mapped
            if (selectedIds.has(productId)) {
                const next = new Set(selectedIds);
                next.delete(productId);
                setSelectedIds(next);
            }
        } catch (e: any) {
            toast.error("Chyba: " + e.message);
            // Revert on failure
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, templateId: previousVal || null } : p));
        }
    };

    const handleBulkMappingChange = async (newTemplateId: string | null) => {
        if (selectedIds.size === 0) return;

        const idsArray = Array.from(selectedIds);

        // Optimistic UI Update
        const previousVals = new Map(idsArray.map(id => [id, products.find(p => p.id === id)?.templateId]));
        setProducts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, templateId: newTemplateId } : p));

        try {
            const res = await fetch('/api/woo/save-mapping', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ webProductIds: idsArray, templateId: newTemplateId })
            });
            if (!res.ok) throw new Error("Failed to save bulk mapping");
            toast.success(`Hromadne upravených ${idsArray.length} produktov`);
            setSelectedIds(new Set()); // Clear selection on success
        } catch (e: any) {
            toast.error("Chyba pri hromadnom ukladaní: " + e.message);
            // Revert on failure
            setProducts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, templateId: previousVals.get(p.id) || null } : p));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                <div className="relative w-[400px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Hľadať produkt podľa SKU alebo Vizuálu..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium transition-shadow focus:shadow-md"
                    />
                </div>

                <div className="flex items-center gap-6">
                    {isSyncing && (
                        <div className="w-80">
                            <ProgressBar progress={syncProgress} label={syncLabel} className="text-xs" />
                        </div>
                    )}
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
                    >
                        <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
                        {isSyncing ? "Sťahujem eshop..." : "Vynútiť Sync E-shopu"}
                    </button>
                </div>
            </div>

            {selectedIds.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-sm flex items-center justify-between mb-4 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3 text-blue-800 font-semibold px-2">
                        <CheckCircle2 size={20} className="text-blue-500" />
                        Označených {selectedIds.size} produktov
                    </div>
                    <div className="flex items-center gap-4 w-[500px]">
                        <span className="text-sm font-medium text-blue-700 whitespace-nowrap">Hromadne priradiť šablónu:</span>
                        <TemplateCombobox
                            value={null} // Keep it empty default
                            templates={templates}
                            onChange={(newId) => {
                                if (newId) handleBulkMappingChange(newId);
                            }}
                        />
                    </div>
                </div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="p-5 w-12 text-center">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                    checked={isAllSelected}
                                    onChange={handleToggleAll}
                                />
                            </th>
                            <th className="p-5 text-xs font-bold text-slate-400 uppercase tracking-widest w-48">Zdroj</th>
                            <th className="p-5 text-xs font-bold text-slate-400 uppercase tracking-widest">E-shop Produkt & SKU</th>
                            <th className="p-5 text-xs font-bold text-slate-400 uppercase tracking-widest w-[450px]">Prepojená Šablóna (Search)</th>
                            <th className="p-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map(p => (
                            <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors group ${selectedIds.has(p.id) ? 'bg-blue-50/50' : ''}`}>
                                <td className="p-5 text-center align-middle">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                        checked={selectedIds.has(p.id)}
                                        onChange={() => handleToggleOne(p.id)}
                                    />
                                </td>
                                <td className="p-5 align-middle">
                                    <span className="inline-flex items-center px-3 py-1.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">
                                        {p.shopName || "Neznámy"}
                                    </span>
                                </td>
                                <td className="p-5 align-middle">
                                    <div className="flex items-center gap-5">
                                        {p.imageUrl ? (
                                            <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white">
                                                <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 text-[10px] uppercase font-bold text-center leading-tight shadow-inner">Bez<br />obr.</div>
                                        )}
                                        <div className="flex flex-col items-start max-w-[400px]">
                                            <div className="font-bold text-slate-900 leading-tight text-sm mb-1">{p.title}</div>
                                            <EditableSku initialSku={p.sku} productId={p.id} onSave={handleSkuSave} />
                                        </div>
                                    </div>
                                </td>
                                <td className="p-5 align-middle">
                                    <TemplateCombobox
                                        value={p.templateId}
                                        templates={templates}
                                        onChange={(newId) => handleMappingChange(p.id, newId)}
                                    />
                                </td>
                                <td className="p-5 align-middle text-center">
                                    <div className="flex justify-center items-center gap-2">
                                        {p.templateId ? (
                                            <>
                                                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 shadow-sm" title="Všetky objednávky tohto SKU budú vždy automaticky párované na túto šablónu.">
                                                    <CheckCircle2 size={24} strokeWidth={2.5} />
                                                </div>
                                                <button
                                                    onClick={() => handleMappingChange(p.id, null)}
                                                    className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
                                                    title="Vymazať spojenie (Undo)"
                                                >
                                                    <X size={16} strokeWidth={2.5} />
                                                </button>
                                            </>
                                        ) : (
                                            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-rose-50 border border-dash border-rose-200 text-rose-500 shadow-sm" title="Nepriradené: Systém musí hádať pomocou AI.">
                                                <AlertCircle size={22} strokeWidth={2.5} />
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredProducts.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-16 text-center">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-slate-100 mb-4 text-slate-400">
                                        <Search size={32} />
                                    </div>
                                    <div className="font-bold text-lg text-slate-900">Žiadne produkty nenašiel filter.</div>
                                    <div className="text-slate-500 text-sm mt-1">Skúste zmeniť text alebo vynútiť stiahnutie katalógu.</div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
