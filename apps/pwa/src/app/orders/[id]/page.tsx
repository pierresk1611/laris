"use client";

import AppHeader from "@/components/AppHeader";
import {
    ChevronLeft,
    Save,
    Play,
    Trash2,
    Maximize2,
    FileText,
    Type,
    ImageIcon,
    ScanSearch,
    FileUp,
    CheckCircle2,
    AlertTriangle,
    Layers,
    Copy,
    RefreshCw,
    Printer
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, use, useMemo } from "react";
import { toast } from "sonner";
import { ProgressBar } from "@/components/ui/ProgressBar";

export default function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [order, setOrder] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Workspace State
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    // Shared Data (Synced across all tabs)
    const [sharedData, setSharedData] = useState({
        names: "",
        date: "",
        location: ""
    });

    // Per-Item Data (Body text is unique per item)
    const [itemsData, setItemsData] = useState<Record<string, { body: string; originalBody: string; isVerified: boolean }>>({});

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await fetch(`/api/woo/orders/${id}`);
                const data = await res.json();
                if (data.success) {
                    const fetchedOrder = data.order;
                    setOrder(fetchedOrder);

                    // Initialize Items Data
                    const initialItemsData: any = {};
                    let firstItem = true;
                    let initialSharedData = { names: "", date: "", location: "" };

                    fetchedOrder.items?.forEach((item: any) => {
                        if (firstItem) {
                            setActiveTabId(item.id.toString());
                            firstItem = false;
                        }

                        // Try to find existing AI data
                        const savedAiData = item.aiData || {};

                        // Extract shared data from the FIRST verified item, or just the first item
                        if (!initialSharedData.names && savedAiData.names) {
                            initialSharedData = {
                                names: savedAiData.names || "",
                                date: savedAiData.date || "",
                                location: savedAiData.location || ""
                            };
                        }

                        // Determine Body Text
                        const options = item.options || {};
                        const textKey = Object.keys(options).find(k => /text|pozvánka|oznámenie|citát/i.test(k));
                        const bodyText = savedAiData.body || options[textKey!] || item.name || "";

                        initialItemsData[item.id] = {
                            body: bodyText,
                            originalBody: savedAiData.originalBody || bodyText,
                            isVerified: item.isVerified || false
                        };
                    });

                    setItemsData(initialItemsData);
                    setSharedData(initialSharedData);

                } else {
                    setError(data.error);
                }
            } catch (e) {
                setError("Nepodarilo sa načítať detaily objednávky.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrder();
    }, [id]);

    const handleSaveAll = async () => {
        if (!order) return;

        const toastId = toast.loading("Ukladám všetky položky...");

        try {
            // Merge state back into items
            const updatedItems = order.items.map((item: any) => {
                const iData = itemsData[item.id] || {};
                return {
                    ...item,
                    isVerified: true, // Mark as verified on save
                    aiData: {
                        names: sharedData.names,
                        date: sharedData.date,
                        location: sharedData.location,
                        body: iData.body,
                        originalBody: iData.originalBody
                    }
                };
            });

            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shopId: order.shopId,
                    items: updatedItems,
                    isVerified: true
                })
            });
            const data = await res.json();

            if (data.success) {
                toast.success("Všetky dáta uložené!", { id: toastId });
                // Optimistically update local order
                setOrder({ ...order, items: updatedItems });

                // Update local items state to reflect verified
                const newItemsData = { ...itemsData };
                Object.keys(newItemsData).forEach(k => newItemsData[k].isVerified = true);
                setItemsData(newItemsData);

            } else {
                toast.error("Chyba pri ukladaní: " + data.message, { id: toastId });
            }
        } catch (e) {
            toast.error("Chyba spojenia", { id: toastId });
        }
    };

    const activeItem = useMemo(() => {
        if (!order || !activeTabId) return null;
        return order.items.find((i: any) => i.id.toString() === activeTabId.toString());
    }, [order, activeTabId]);


    // Preview State
    const [previews, setPreviews] = useState<Record<string, string>>({});
    const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({});

    const handleGeneratePreview = async (itemId: string) => {
        if (!order) return;
        const item = order.items.find((i: any) => i.id.toString() === itemId);
        if (!item || !item.templateKey) {
            toast.error("Položka nemá priradenú šablónu.");
            return;
        }

        setIsGenerating(prev => ({ ...prev, [itemId]: true }));
        const toastId = toast.loading(`Generujem náhľad pre ${item.name}...`);

        try {
            const res = await fetch('/api/print/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: order.id,
                    itemId: item.id,
                    templateKey: item.templateKey,
                    data: {
                        names: sharedData.names,
                        date: sharedData.date,
                        location: sharedData.location,
                        body: itemsData[itemId]?.body || ""
                    }
                })
            });
            const result = await res.json();

            if (result.success && result.url) {
                setPreviews(prev => ({ ...prev, [itemId]: result.url }));
                toast.success("Náhľad vygenerovaný!", { id: toastId });
            } else {
                if (result.requiresAgent) {
                    toast.warning(result.error, { id: toastId, duration: 5000 });
                } else {
                    toast.error("Chyba generovania: " + (result.error || "Neznáma chyba"), { id: toastId });
                }
            }
        } catch (e) {
            toast.error("Chyba spojenia", { id: toastId });
        } finally {
            setIsGenerating(prev => ({ ...prev, [itemId]: false }));
        }
    };

    const handleBulkGenerate = async () => {
        if (!order || !order.items) return;

        const toastId = toast.loading("Spúšťam hromadné generovanie...");
        let successCount = 0;

        // Iterate sequentially to avoid overwhelming the Agent/Photoshop
        for (const item of order.items) {
            if (item.templateKey) {
                try {
                    // Trigger generation (reuse logic or call API)
                    // We'll call the same API endpoint
                    setIsGenerating(prev => ({ ...prev, [item.id]: true }));

                    const res = await fetch('/api/print/preview', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderId: order.id,
                            itemId: item.id,
                            templateKey: item.templateKey,
                            data: {
                                names: sharedData.names,
                                date: sharedData.date,
                                location: sharedData.location,
                                body: itemsData[item.id]?.body || ""
                            }
                        })
                    });
                    const result = await res.json();
                    if (result.success && result.url) {
                        setPreviews(prev => ({ ...prev, [item.id]: result.url }));
                        successCount++;
                    }
                } catch (e) {
                    console.error(`Failed to generate for ${item.id}`, e);
                } finally {
                    setIsGenerating(prev => ({ ...prev, [item.id]: false }));
                }
            }
        }

        toast.success(`Hromadné generovanie dokončené. Úspešne: ${successCount} / ${order.items.length}`, { id: toastId });
    };

    const handleSendToPrint = async () => {
        if (!order || !order.items) return;

        const toastId = toast.loading("Odosielam do tlače...");

        try {
            await handleSaveAll(); // Ensure latest data is saved

            const res = await fetch('/api/agent/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'STATUS_PRINT_READY',
                    payload: {
                        orderId: order.id,
                        customerName: order.customer,
                        items: order.items.filter((i: any) => i.templateKey).map((item: any) => {
                            const iData = itemsData[item.id] || {};
                            return {
                                id: item.id,
                                template_rel_path: `TEMPLATES/${item.templateKey}.psd`,
                                data: {
                                    names: sharedData.names,
                                    date: sharedData.date,
                                    location: sharedData.location,
                                    body: iData.body || ""
                                }
                            };
                        })
                    }
                })
            });

            const data = await res.json();
            if (data.success) {
                toast.success("Úloha odoslaná Agentovi na tlač!", { id: toastId });
            } else {
                toast.error("Chyba odoslania: " + data.message, { id: toastId });
            }
        } catch (e) {
            toast.error("Chyba spojenia", { id: toastId });
        }
    };


    if (isLoading) return <div className="p-12 text-center text-slate-400 font-bold flex items-center justify-center gap-2"><RefreshCw className="animate-spin" /> Načítavam...</div>;
    if (error || !order) return (
        <div className="p-12 text-center text-red-500 font-bold">
            <p>Chyba pri načítaní detailov.</p>
            <p className="text-sm font-normal mt-2">{error}</p>
            <Link href="/" className="mt-4 inline-block text-blue-600 underline">Späť na prehľad</Link>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
            {/* HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <ChevronLeft size={24} className="text-slate-600" />
                    </Link>
                    <div>
                        <div className="flex items-baseline gap-3">
                            <h1 className="text-xl font-black text-slate-900">#{order.number}</h1>
                            <span className="text-sm font-bold text-slate-500">{order.customer}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                            <span>{order.shopSource}</span>
                            <span>•</span>
                            <span>{new Date(order.date).toLocaleDateString('sk-SK')}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSaveAll}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                    >
                        <Save size={16} />
                        <span>Uložiť Všetko</span>
                    </button>

                    <button
                        onClick={handleBulkGenerate}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-800 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all border border-slate-200"
                    >
                        <Play size={16} className="text-purple-600" />
                        <span>Generovať Celú Sadu</span>
                    </button>

                    <button
                        onClick={handleSendToPrint}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                    >
                        <Printer size={16} className="text-yellow-400" />
                        <span>Odoslať do tlače</span>
                    </button>
                </div>
            </div>

            {/* WORKSPACE CONTENT */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT: TABS & ITEM LIST */}
                <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col overflow-y-auto">
                    <div className="p-4">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Položky objednávky</h3>
                        <div className="space-y-2">
                            {order.items?.map((item: any) => {
                                const isActive = activeTabId === item.id.toString();
                                const hasTemplate = !!item.templateKey;
                                const isVerified = itemsData[item.id]?.isVerified;
                                const isGen = isGenerating[item.id];

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveTabId(item.id.toString())}
                                        className={`w-full text-left p-3 rounded-xl transition-all border ${isActive
                                            ? 'bg-white border-blue-200 shadow-sm ring-1 ring-blue-100'
                                            : 'bg-transparent border-transparent hover:bg-slate-100'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${hasTemplate ? 'text-blue-600' : 'text-slate-400'}`}>
                                                {item.templateKey || 'BEZ ŠABLÓNY'}
                                            </span>
                                            {isGen ? <RefreshCw size={12} className="animate-spin text-blue-500" /> : (isVerified && <CheckCircle2 size={12} className="text-green-500" />)}
                                        </div>
                                        <div className={`text-xs font-bold ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                                            {item.name}
                                        </div>
                                        {/* Optional: Show small preview of content? */}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* MIDDLE: EDITOR COMPONENT */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-100/50">

                    {/* EDITOR FORM */}
                    <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-slate-200 bg-white">
                        {activeItem ? (
                            <div className="max-w-xl mx-auto space-y-8">

                                {/* SHARED DATA SECTION */}
                                <section className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                                    <div className="flex items-center gap-2 mb-4 text-blue-800">
                                        <Layers size={16} />
                                        <h3 className="text-xs font-bold uppercase tracking-widest">Spoločné údaje (Zdieľané)</h3>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mená</label>
                                            <input
                                                type="text"
                                                value={sharedData.names}
                                                onChange={(e) => setSharedData({ ...sharedData, names: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="napr. Mária & Peter"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Dátum</label>
                                                <input
                                                    type="text"
                                                    value={sharedData.date}
                                                    onChange={(e) => setSharedData({ ...sharedData, date: e.target.value })}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="24.08.2024"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Miesto</label>
                                                <input
                                                    type="text"
                                                    value={sharedData.location}
                                                    onChange={(e) => setSharedData({ ...sharedData, location: e.target.value })}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="Bratislava"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* ITEM SPECIFIC DATA */}
                                <section>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                                            Text pre: <span className="text-slate-700">{activeItem.name}</span>
                                        </label>
                                        <button
                                            onClick={() => {
                                                // Todo: AI Parse Logic specifically for this body
                                                toast.info("AI Parse pre toto pole zatiaľ nie je napojený na tlačidlo.");
                                            }}
                                            className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                                        >
                                            AI PARSE
                                        </button>
                                    </div>
                                    <textarea
                                        rows={8}
                                        value={itemsData[activeItem.id]?.body || ""}
                                        onChange={(e) => setItemsData({
                                            ...itemsData,
                                            [activeItem.id]: { ...itemsData[activeItem.id], body: e.target.value }
                                        })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all resize-none shadow-sm"
                                        placeholder="Text pre túto položku..."
                                    />
                                </section>

                                {/* SOURCE DATA (READ ONLY) */}
                                <section className="pt-6 border-t border-slate-100">
                                    <details className="group">
                                        <summary className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                            <ScanSearch size={16} />
                                            <span className="text-xs font-bold uppercase tracking-widest">Zobraziť zdrojové dáta</span>
                                        </summary>
                                        <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 font-mono whitespace-pre-wrap">
                                            {JSON.stringify(activeItem.options, null, 2)}
                                        </div>
                                    </details>
                                </section>

                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                Vyberte položku zo zoznamu
                            </div>
                        )}
                    </div>

                    {/* PREVIEW COMPONENT (RIGHT COLUMN) */}
                    <div className="w-full md:w-1/2 bg-slate-900 p-8 flex flex-col justify-center items-center relative overflow-hidden hidden md:flex">
                        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10">
                            <div className="text-white/50 text-xs font-mono">
                                {activeItem?.templateKey ? `TEMPLATE: ${activeItem.templateKey}` : 'NO TEMPLATE'}
                            </div>
                        </div>

                        {activeItem ? (
                            <div className="w-full max-w-md aspect-[3/4] bg-white rounded shadow-2xl relative border-[8px] border-white group">
                                {previews[activeItem.id] ? (
                                    <img
                                        src={previews[activeItem.id]}
                                        alt="Preview"
                                        className="w-full h-full object-contain bg-slate-100"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                                        <ImageIcon size={48} className="mb-4 opacity-50" />
                                        <p className="font-bold text-slate-900">Náhľad pre {activeItem.templateKey}</p>
                                        <button
                                            onClick={() => handleGeneratePreview(activeItem.id)}
                                            disabled={isGenerating[activeItem.id]}
                                            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors"
                                        >
                                            Generovať Náhľad
                                        </button>
                                    </div>
                                )}

                                <div className="absolute bottom-6 left-0 w-full flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleGeneratePreview(activeItem.id)}
                                        disabled={isGenerating[activeItem.id]}
                                        className="px-6 py-2 bg-slate-900 text-white rounded-full text-xs font-bold hover:bg-black transition-colors shadow-xl disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isGenerating[activeItem.id] ? <RefreshCw className="animate-spin" size={14} /> : <Play size={14} className="text-blue-400" />}
                                        <span>{previews[activeItem.id] ? 'Pre-generovať' : 'Generovať Náhľad'}</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-white/30 font-bold">Žiadny náhľad</div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
