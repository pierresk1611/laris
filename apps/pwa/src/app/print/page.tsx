"use client";

import AppHeader from "@/components/AppHeader";
import { useState, useEffect, useMemo } from "react";
import { Printer, Layers, FileCheck, AlertCircle, RefreshCw, Grid as GridIcon } from "lucide-react";
import { calculateImposition, PAPER_SIZES, SheetLayout } from "@/lib/imposition";

interface PrintOrder {
    id: string; // Woo ID
    number: string;
    items: any[];
    localStatus: 'PROCESSING' | 'READY_FOR_PRINT' | 'PRINTED';
    shopName: string;
}

export default function PrintManagerPage() {
    const [orders, setOrders] = useState<PrintOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMaterial, setSelectedMaterial] = useState<string>("All");
    const [layout, setLayout] = useState<SheetLayout | null>(null);

    // Imposition Settings
    const [canvasSize, setCanvasSize] = useState(PAPER_SIZES.SRA3);
    const [itemSize, setItemSize] = useState({ width: 105, height: 148 }); // A6 default

    // Bulk Selection
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

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

    useEffect(() => {
        fetchOrders();
    }, []);

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

    // Calculate Imposition when orders change or settings change
    useEffect(() => {
        const totalItems = filteredOrders.reduce((sum, o) => {
            return sum + o.items.reduce((s, i) => s + i.quantity, 0);
        }, 0);

        if (totalItems > 0) {
            const calculated = calculateImposition(canvasSize, itemSize, totalItems);
            setLayout(calculated);
        } else {
            setLayout(null);
        }
    }, [filteredOrders, canvasSize, itemSize]);


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
                            {layout && (
                                <>
                                    <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">
                                        Vybrané: {ordersToImpose.length} obj.
                                    </span>
                                    <span className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-500">
                                        {layout.itemsPerSheet} ks / hárok
                                    </span>
                                    <span className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-500">
                                        Celkom {layout.totalSheets} hárkov
                                    </span>
                                </>
                            )}
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
                                disabled={!layout}
                                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 transition-all"
                            >
                                Vytvoriť tlačový hárok (Agent)
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
                                            onClick={() => toggleOrder(order.id, order.shopName)}
                                            className={`p-3 border rounded-2xl transition-colors flex justify-between items-center cursor-pointer select-none group ${isSelected ? 'bg-blue-50 border-blue-200' : 'border-slate-100 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'
                                                    }`}>
                                                    {isSelected && <FileCheck size={12} className="text-white" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-slate-900">#{order.number}</span>
                                                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold">{order.shopName}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-400 mt-1">
                                                        {order.items[0]?.name?.substring(0, 30)}...
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="block font-black text-slate-900 text-lg">{totalQty} <span className="text-[10px] text-slate-400 uppercase">ks</span></span>
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
                                    SRA3 Preview ({layout?.sheetWidth}x{layout?.sheetHeight}mm)
                                </div>

                                {/* Canvas Renderer */}
                                {layout && (
                                    <div
                                        className="bg-white shadow-2xl relative transition-all duration-500 origin-center"
                                        style={{
                                            width: `${layout.sheetWidth}px`,
                                            height: `${layout.sheetHeight}px`,
                                            transform: 'scale(0.65)', // Scale down further to fit UI
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

                                {!layout && (
                                    <div className="text-white/30 text-center">
                                        <GridIcon size={48} className="mx-auto mb-4" />
                                        <p>Vyberte objednávky v zozname (kliknutím)</p>
                                        <p className="text-xs mt-2 opacity-50">Náhľad sa aktualizuje automaticky</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
