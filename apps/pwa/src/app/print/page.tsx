"use client";

import AppHeader from "@/components/AppHeader";
import { useState, useEffect, useMemo } from "react";
import { Printer, Layers, FileCheck, AlertCircle, RefreshCw, Grid as GridIcon, Settings2 } from "lucide-react";
import { calculateImposition, PAPER_SIZES, SheetLayout } from "@/lib/imposition";

interface PrintOrder {
    id: string; // Woo ID
    number: string;
    crmId?: string | null; // CRM ID
    items: any[];
    localStatus: 'PROCESSING' | 'READY_FOR_PRINT' | 'PRINTED';
    sheetFormat: string; // SRA3, A4, etc.
    shopName: string;
    shopId: string; // Needed for update API
}

// Bulk Selection
const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

// Configurable Formats
const [availableFormats, setAvailableFormats] = useState<Record<string, { width: number, height: number }>>({
    ...PAPER_SIZES,
    "METAL_225_300": { width: 225, height: 300 }
});
const [formatKeys, setFormatKeys] = useState<string[]>(["SRA3", "A4", "A3", "METAL_225_300"]);

useEffect(() => {
    fetchOrders();
    fetchSettings();
}, []);

const fetchSettings = async () => {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.success && data.settings) {
            const formatSetting = data.settings.find((s: any) => s.id === 'PRINT_FORMATS');
            if (formatSetting && formatSetting.value) {
                try {
                    const parsed = JSON.parse(formatSetting.value);
                    setAvailableFormats(parsed);

                    // Sort: SRA3, A4, then others alphabetically
                    const priority = ["SRA3", "A4"];
                    const keys = Object.keys(parsed).sort((a, b) => {
                        const idxA = priority.indexOf(a);
                        const idxB = priority.indexOf(b);
                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                        return a.localeCompare(b);
                    });
                    setFormatKeys(keys);
                } catch (e) {
                    console.error("Invalid PRINT_FORMATS JSON", e);
                }
            }
        }
    } catch (e) {
        console.error("Failed to load settings", e);
    }
};

const fetchOrders = async () => {
    setLoading(true);
    try {
        const res = await fetch('/api/print/orders');
        const data = await res.json();
        if (data.success) {
            setOrders(data.orders);
        }
    } catch (e) {
        console.error("Failed to load print orders", e);
    } finally {
        setLoading(false);
    }
};

const updateOrderFormat = async (orderId: string, shopId: string, format: string) => {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === orderId && o.shopId === shopId ? { ...o, sheetFormat: format } : o));

    try {
        await fetch(`/api/orders/${orderId}/format`, {
            method: 'POST', // or PATCH
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shopId, sheetFormat: format })
        });
    } catch (e) {
        console.error("Failed to save format", e);
        fetchOrders(); // Revert on error
    }
};

// Group by Material
const materials = useMemo(() => {
    const mats = new Set<string>();
    orders.forEach(o => {
        o.items.forEach(i => {
            if (i.material) mats.add(i.material);
            else mats.add("Neznámy papier");
        });
    });
    return Array.from(mats).sort();
}, [orders]);

const filteredOrders = useMemo(() => {
    if (selectedMaterial === "All") return orders;
    return orders.filter(o => o.items.some(i => (i.material || "Neznámy papier") === selectedMaterial));
}, [orders, selectedMaterial]);

const toggleOrder = (id: string, shopName: string) => {
    const key = `${shopName}-${id}`;
    const newSet = new Set(selectedOrders);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setSelectedOrders(newSet);
};

const toggleAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
        setSelectedOrders(new Set());
    } else {
        const newSet = new Set<string>();
        filteredOrders.forEach(o => newSet.add(`${o.shopName}-${o.id}`));
        setSelectedOrders(newSet);
    }
};

// Calculate Imposition based on SELECTED orders ONLY
const ordersToImpose = useMemo(() => {
    return filteredOrders.filter(o => selectedOrders.has(`${o.shopName}-${o.id}`));
}, [filteredOrders, selectedOrders]);

// Determine Logic State for Button & Layout
const impositionState = useMemo(() => {
    if (ordersToImpose.length === 0) return { valid: false, message: "Vyberte objednávky" };

    // Grouping Constraint: All selected logic must have SAME format for simple batching?
    // Or we just take the first one?
    // Requirement: "System must group automatically".
    // If user manually selects Mixed formats, we should probably warn or disable.

    const firstFormat = ordersToImpose[0].sheetFormat;
    const uniform = ordersToImpose.every(o => o.sheetFormat === firstFormat);

    if (!uniform) return { valid: false, message: "Vybrané objednávky majú rôzne formáty hárku!" };
    return { valid: true, format: firstFormat };

}, [ordersToImpose]);

// Recalculate Layout
useEffect(() => {
    const totalItems = ordersToImpose.reduce((sum, o) => {
        return sum + o.items.reduce((s, i) => s + i.quantity, 0);
    }, 0);

    if (totalItems > 0 && impositionState.valid && impositionState.format) {
        // Map format string to Dimensions using DYNAMIC formats
        const size = availableFormats[impositionState.format] || PAPER_SIZES.SRA3;

        const calculated = calculateImposition(size, itemSize, totalItems);
        setLayout(calculated);
    } else {
        setLayout(null);
    }
}, [ordersToImpose, impositionState, availableFormats]);


return (
    <main className="min-h-screen bg-slate-50 p-8">
        <AppHeader title="Print Manager" />

        {/* Top Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                        <Layers size={20} />
                    </div>
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Objednávky</span>
                </div>
                <p className="text-3xl font-black text-slate-900">{orders.length}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                        <FileCheck size={20} />
                    </div>
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Materiály</span>
                </div>
                <p className="text-3xl font-black text-slate-900">{materials.length}</p>
            </div>
        </div>

        <div className="grid grid-cols-12 gap-8">

            {/* Sidebar - Materials */}
            <div className="col-span-3 space-y-4">
                <h3 className="font-black text-slate-900 text-lg px-2">Typ Papiera</h3>
                <div className="space-y-2">
                    <button
                        onClick={() => { setSelectedMaterial("All"); setSelectedOrders(new Set()); }}
                        className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all flex justify-between items-center ${selectedMaterial === "All" ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        <span>Všetky</span>
                        <span className="bg-slate-700/20 px-2 py-0.5 rounded text-xs">{orders.length}</span>
                    </button>
                    {materials.map(mat => (
                        <button
                            key={mat}
                            onClick={() => { setSelectedMaterial(mat); setSelectedOrders(new Set()); }}
                            className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all flex justify-between items-center ${selectedMaterial === mat ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'
                                }`}
                        >
                            <span>{mat}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="col-span-9 space-y-6">

                {/* Toolbar */}
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 sticky top-4 z-20 shadow-sm">
                    <div className="flex items-center gap-4">
                        <h2 className="font-black text-slate-900 flex items-center gap-2">
                            <Printer size={20} />
                            {selectedMaterial}
                        </h2>
                        {itemsPerSheetDetails(layout, ordersToImpose)}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={fetchOrders}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-colors"
                            title="Obnoviť"
                        >
                            <RefreshCw size={20} />
                        </button>
                        <button
                            disabled={!impositionState.valid}
                            onClick={async () => {
                                if (!layout || !impositionState.valid) return;
                                if (!confirm(`Vytvoriť tlačový hárok (${impositionState.format}) pre ${ordersToImpose.length} objednávok?`)) return;

                                createAgentJob(layout, selectedMaterial, ordersToImpose, impositionState.format!);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 transition-all"
                        >
                            {impositionState.valid ? `Vytvoriť hárok (${impositionState.format})` : impositionState.message}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                    {/* List View */}
                    <div className="bg-white rounded-3xl border border-slate-200 p-6 min-h-[500px]">
                        <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest mb-4 flex justify-between items-center">
                            <span>Položky na tlač</span>
                            <button onClick={toggleAll} className="text-blue-500 hover:underline">
                                {selectedOrders.size === filteredOrders.length ? 'Zrušiť výber' : 'Vybrať všetko'}
                            </button>
                        </h3>
                        <div className="space-y-3">
                            {filteredOrders.map(order => {
                                const key = `${order.shopName}-${order.id}`;
                                const isSelected = selectedOrders.has(key);
                                const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

                                return (
                                    <div
                                        key={key}
                                        className={`p-3 border rounded-2xl transition-all select-none group ${isSelected ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'border-slate-100 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div
                                                onClick={() => toggleOrder(order.id, order.shopName)}
                                                className="flex items-center gap-3 cursor-pointer flex-1"
                                            >
                                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'
                                                    }`}>
                                                    {isSelected && <FileCheck size={12} className="text-white" />}
                                                </div>
                                                <div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-slate-900 text-base">
                                                                {order.crmId ? order.crmId : `#${order.number}`}
                                                            </span>
                                                            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold">{order.shopName}</span>
                                                        </div>
                                                        {order.crmId && (
                                                            <div className="text-[9px] text-slate-300 font-mono">Woo: #{order.number}</div>
                                                        )}
                                                        <div className="text-xs text-slate-400 mt-1">
                                                            {order.items[0]?.name?.substring(0, 30)}...
                                                            {order.items.length > 1 && <span className="text-blue-500 font-bold ml-1">(+ {order.items.length - 1} položky)</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    {/* Format Dropdown */}
                                                    <div className="flex flex-col items-end">
                                                        <label className="text-[9px] font-bold text-slate-300 uppercase mb-0.5">Formát hárku</label>
                                                        <select
                                                            value={order.sheetFormat || "SRA3"}
                                                            onChange={(e) => updateOrderFormat(order.id, order.shopId, e.target.value)}
                                                            onClick={(e) => e.stopPropagation()} // Prevent row toggle
                                                            className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                                        >
                                                            {formatKeys.map(f => (
                                                                <option key={f} value={f}>{f}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="text-right min-w-[60px]">
                                                        {totalQty === 1 ? (
                                                            <span className="block font-black text-orange-500 text-lg flex items-center justify-end gap-1" title="Skontrolujte počet kusov (vyzerá to na default)">
                                                                <AlertCircle size={12} /> {totalQty} <span className="text-[10px] uppercase">ks?</span>
                                                            </span>
                                                        ) : (
                                                            <span className="block font-black text-slate-900 text-lg">{totalQty} <span className="text-[10px] text-slate-400 uppercase">ks</span></span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        )
                                })}

                                        {filteredOrders.length === 0 && (
                                            <div className="text-center py-12 text-slate-400">
                                                <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
                                                <p>Žiadne schválené objednávky pre tento papier</p>
                                            </div>
                                        )}
                                    </div>
                    </div>

                        {/* Visual Preview */}
                        <div className="sticky top-24 h-fit">
                            <div className="bg-slate-800 rounded-3xl border border-slate-700 p-8 flex flex-col items-center justify-center relative overflow-hidden min-h-[400px]">
                                <div className="absolute top-4 left-4 text-white/50 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                    <GridIcon size={14} />
                                    {impositionState.valid ?
                                        `Preview: ${impositionState.format} (${layout?.sheetWidth}x${layout?.sheetHeight}mm)`
                                        : 'Preview nedostupný'}
                                </div>

                                {/* Canvas Renderer */}
                                {layout && impositionState.valid && (
                                    <div
                                        className="bg-white shadow-2xl relative transition-all duration-500 origin-center"
                                        style={{
                                            width: `${layout.sheetWidth}px`,
                                            height: `${layout.sheetHeight}px`,
                                            transform: 'scale(0.5)', // Adjusted scale for bigger sheets
                                        }}
                                    >
                                        {/* Render Items */}
                                        {layout.items.map((rect, idx) => (
                                            <div
                                                key={idx}
                                                className="absolute border border-slate-300 bg-blue-50 flex items-center justify-center text-[10px] text-blue-300 font-bold"
                                                style={{
                                                    left: `${rect.x}px`,
                                                    top: `${rect.y}px`,
                                                    width: `${rect.width}px`,
                                                    height: `${rect.height}px`
                                                }}
                                            >
                                                {idx + 1}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {(!layout || !impositionState.valid) && (
                                    <div className="text-white/30 text-center">
                                        <GridIcon size={48} className="mx-auto mb-4" />
                                        <p>{impositionState.message || "Vyberte objednávky v zozname"}</p>
                                        {!impositionState.valid && selectedOrders.size > 0 && (
                                            <p className="text-xs mt-2 text-red-400 font-bold">Tip: Zvoľte rovnaký formát pre všetky vybrané položky.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    </main>
);

// Helpers
function itemsPerSheetDetails(l: SheetLayout | null, selected: any[]) {
    if (!l) return null;
    return (
        <>
            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">
                Vybrané: {selected.length} obj.
            </span>
            <span className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-500">
                {l.itemsPerSheet} ks / hárok
            </span>
            <span className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-500">
                Celkom {l.totalSheets} hárkov
            </span>
        </>
    );
}

async function createAgentJob(l: SheetLayout, mat: string, orders: any[], fmt: string) {
    try {
        const res = await fetch('/api/agent/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'MERGE_SHEET',
                payload: {
                    layout: l,
                    material: mat,
                    sheetFormat: fmt,
                    orders: orders.map(o => ({
                        id: o.id,
                        shopName: o.shopName,
                        number: o.number,
                        crmId: o.crmId // Pass CRM ID
                    }))
                }
            })
        });
        const data = await res.json();
        if (data.success) {
            alert(`Úloha pre Agent vytvorená (Job #${data.job.id})`);
            setSelectedOrders(new Set());
        } else {
            alert("Chyba: " + data.message);
        }
    } catch (e) {
        alert("Chyba spojenia");
    }
}
}
