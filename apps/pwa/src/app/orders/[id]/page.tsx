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
    FileUp
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, use } from "react";

export default function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [order, setOrder] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [aiData, setAiData] = useState({
        names: "",
        date: "",
        location: "",
        body: "",
        originalBody: ""
    });

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await fetch(`/api/woo/orders/${id}`);
                const data = await res.json();
                if (data.success) {
                    setOrder(data.order);
                    const item = data.order.items?.[0];
                    const options = item?.options || {};

                    // Smart pre-fill from EPO data
                    // 1. Find the main text block (usually "Text pozvánky" or similar)
                    const textKey = Object.keys(options).find(k => /text|pozvánka|oznámenie|citát/i.test(k));
                    const bodyText = textKey ? options[textKey] : (item?.name || "");

                    setAiData({
                        names: "", // Clear to avoid wrong customer name guessing
                        date: "",  // Clear to avoid wrong order date
                        location: "",
                        body: bodyText, // Fill with the raw text for AI to parse
                        originalBody: bodyText // Keep original for AI learning
                    });
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

    if (isLoading) return <div className="p-12 text-center text-slate-400 font-bold">Načítavam objednávku...</div>;
    if (error || !order) return (
        <div className="p-12 text-center text-red-500 font-bold">
            <p>Chyba pri načítaní detailov.</p>
            <p className="text-sm font-normal mt-2">{error}</p>
            <Link href="/" className="mt-4 inline-block text-blue-600 underline">Späť na prehľad</Link>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <ChevronLeft size={24} className="text-slate-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Objednávka #{order.number}</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Šablóna: {order.items?.[0]?.templateKey || 'Nezistená'} • Zdroj: {order.shopSource}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors">
                        <Trash2 size={16} />
                        <span>Zrušiť</span>
                    </button>
                    <button className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-shadow shadow-sm shadow-blue-200">
                        <Save size={16} />
                        <span>Uložiť & Synchronizovať</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden pb-6">
                {/* Left: Source Text */}
                <div className="col-span-3 flex flex-col bg-slate-100/50 rounded-2xl border border-slate-200/60 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-white/50">
                        <FileText size={16} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Zdrojové dáta</span>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto">
                        <div className="prose prose-sm text-slate-600 leading-relaxed font-mono text-[13px] bg-white p-4 rounded-xl border border-slate-200">
                            <strong>Zákazník:</strong> {order.customer} <br />
                            <strong>E-mail:</strong> {order.billing?.email || 'Nezadaný'} <br /><br />

                            {order.items?.map((item: any) => (
                                <div key={item.id} className="mb-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                    <p className="font-bold text-slate-900 mb-1">• {item.name}</p>

                                    {/* Display all raw options (EPO) */}
                                    {item.options && Object.entries(item.options).length > 0 ? (
                                        <div className="bg-slate-50 rounded border border-slate-100 mt-2 overflow-hidden">
                                            {/* Download Buttons for Uploads */}
                                            {item.downloads && item.downloads.length > 0 && (
                                                <div className="p-2 bg-blue-50 border-b border-blue-100 flex flex-col gap-1">
                                                    {item.downloads.map((dl: any, idx: number) => (
                                                        <a
                                                            key={idx}
                                                            href={dl.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center justify-between gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors shadow-sm"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Play size={12} className="rotate-90" />
                                                                <span>STIAHNUŤ: {dl.label}</span>
                                                            </div>
                                                        </a>
                                                    ))}
                                                </div>
                                            )}

                                            {Object.entries(item.options)
                                                .filter(([key]) => key !== 'downloads')
                                                .map(([key, val]) => (
                                                    <div key={key} className="group flex flex-col border-b border-slate-100 last:border-0 p-2 hover:bg-slate-100 transition-colors">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{key}</span>
                                                            <button
                                                                onClick={() => navigator.clipboard.writeText(typeof val === 'object' ? JSON.stringify(val) : String(val))}
                                                                className="opacity-0 group-hover:opacity-100 text-[9px] text-blue-500 hover:text-blue-700 px-1"
                                                                title="Kopírovať"
                                                            >
                                                                COPY
                                                            </button>
                                                        </div>
                                                        <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-medium">
                                                            {typeof val === 'object' && val !== null && 'url' in (val as any) ? (
                                                                <div className="mt-1 p-2 bg-blue-50 border border-blue-100 rounded flex items-center gap-2">
                                                                    <a href={(val as any).url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline flex items-center gap-1 font-medium">
                                                                        <span>📎</span> Stiahnuť {(val as any).name || 'súbor'}
                                                                    </a>
                                                                </div>
                                                            ) : (
                                                                <span>{String(val)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic mt-1">Žiadne extra dáta</p>
                                    )}

                                    {/* Raw Metadata Dump (Collapsible) */}
                                    <details className="mt-2 group">
                                        <summary className="text-[9px] font-bold text-slate-300 cursor-pointer hover:text-blue-500 uppercase tracking-widest list-none flex items-center gap-1">
                                            <span className="group-open:rotate-90 transition-transform">▶</span>
                                            DEBUG: SUROVÉ DÁTA (RAW)
                                        </summary>
                                        <div className="bg-slate-900 rounded p-2 mt-1 overflow-x-auto text-left">
                                            {item.rawMetaData?.map((meta: any, idx: number) => (
                                                <div key={idx} className="border-b border-slate-700/50 pb-2 mb-2 last:border-0 last:pb-0 font-mono">
                                                    <div className="text-[10px] text-yellow-500 font-bold break-all">
                                                        {meta.key}
                                                    </div>
                                                    <div className="text-[9px] text-slate-300 whitespace-pre-wrap break-words mt-0.5">
                                                        {typeof meta.value === 'object' || Array.isArray(meta.value)
                                                            ? JSON.stringify(meta.value, null, 2)
                                                            : String(meta.value)
                                                        }
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="text-[9px] text-slate-500 italic mt-2 text-center">
                                                Koniec výpisu
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Middle: AI Editor */}
                <div className="col-span-5 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Type size={16} className="text-blue-500" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Smart Editor</span>
                            </div>

                            {/* Import from File Button */}
                            {order.items?.[0]?.downloads && order.items[0].downloads.length > 0 && (
                                <button
                                    onClick={async (e) => {
                                        const btn = e.currentTarget;
                                        const originalContent = btn.innerHTML;
                                        btn.innerHTML = "⏳ IMPORTOVANIE...";
                                        btn.disabled = true;

                                        try {
                                            const dl = order.items[0].downloads[0];
                                            const res = await fetch('/api/ai/parse-file', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    fileUrl: dl.url,
                                                    fileName: dl.name
                                                })
                                            });
                                            const result = await res.json();
                                            if (result.success && result.data) {
                                                setAiData(prev => ({
                                                    ...prev,
                                                    names: result.data // result.data contains the newline separated string
                                                }));
                                            } else {
                                                alert("Chyba importu: " + (result.error || "Nepodarilo sa spracovať súbor"));
                                            }
                                        } catch (err) {
                                            console.error("File Import error:", err);
                                            alert("Chyba spojenia pri importe");
                                        } finally {
                                            btn.innerHTML = originalContent;
                                            btn.disabled = false;
                                        }
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[9px] font-bold hover:bg-amber-100 transition-colors disabled:opacity-50"
                                >
                                    <FileUp size={12} />
                                    <span>IMPORT ZO SÚBORU</span>
                                </button>
                            )}
                        </div>
                        <button
                            onClick={async (e) => {
                                const btn = e.currentTarget;
                                const originalText = btn.innerText;
                                btn.innerText = "⏳ AI PARSUJE...";
                                btn.disabled = true;

                                try {
                                    const res = await fetch('/api/ai/parse', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            text: aiData.body,
                                            options: order.items?.[0]?.options
                                        })
                                    });
                                    const result = await res.json();
                                    if (result.success && result.data) {
                                        setAiData(prev => ({
                                            ...prev,
                                            names: result.data.names || "",
                                            location: result.data.location || "",
                                            date: result.data.date || "",
                                            body: "" // Clear body to avoid duplication
                                        }));
                                    } else {
                                        alert("AI Chyba: " + (result.error || "Nepodarilo sa parsovať"));
                                    }
                                } catch (err) {
                                    console.error("AI Parse error:", err);
                                    alert("Chyba pripojenia k AI");
                                } finally {
                                    btn.innerText = originalText;
                                    btn.disabled = false;
                                }
                            }}
                            className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline disabled:opacity-50"
                        >
                            Pre-parsovať znova
                        </button>
                        <button
                            onClick={async (e) => {
                                const btn = e.currentTarget;
                                const originalText = btn.innerText;
                                btn.innerText = "⏳ Ukladám...";

                                try {
                                    await fetch('/api/ai/patterns', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            input: (aiData as any).originalBody || aiData.body,
                                            output: {
                                                names: aiData.names,
                                                location: aiData.location,
                                                date: aiData.date
                                            }
                                        })
                                    });
                                    btn.innerText = "✅ Uložené!";
                                    setTimeout(() => btn.innerText = originalText, 2000);
                                } catch (err) {
                                    btn.innerText = "❌ Chyba";
                                    setTimeout(() => btn.innerText = originalText, 2000);
                                }
                            }}
                            className="text-[10px] font-bold text-green-600 uppercase tracking-widest hover:underline ml-4"
                            title="Uložiť aktuálne dáta ako vzor pre AI"
                        >
                            🎓 Učiť AI
                        </button>
                    </div>
                    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mená / Hlavný text</label>
                            <input
                                type="text"
                                value={aiData.names}
                                onChange={(e) => setAiData({ ...aiData, names: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Dátum</label>
                            <input
                                type="text"
                                value={aiData.date}
                                onChange={(e) => setAiData({ ...aiData, date: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Miesto</label>
                            <input
                                type="text"
                                value={aiData.location}
                                onChange={(e) => setAiData({ ...aiData, location: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Hlavný blok (TEXT_CONTENT)</label>
                            <textarea
                                rows={4}
                                value={aiData.body}
                                onChange={(e) => setAiData({ ...aiData, body: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all resize-none"
                            />
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                        <button className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors">
                            <Play size={16} className="text-blue-400" />
                            <span>Generovať náhľad (Photoshop)</span>
                        </button>
                    </div>
                </div>

                {/* Right: Preview */}
                <div className="col-span-4 flex flex-col bg-slate-900 rounded-2xl overflow-hidden relative group">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-md absolute top-0 left-0 w-full z-10 transition-opacity opacity-0 group-hover:opacity-100">
                        <div className="flex items-center gap-2">
                            <ImageIcon size={16} className="text-blue-400" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest">Náhľad grafiky</span>
                        </div>
                        <button className="p-2 border border-white/10 rounded-lg hover:bg-white/10 text-white">
                            <Maximize2 size={14} />
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="w-full aspect-[3/4] bg-white rounded shadow-2xl overflow-hidden relative border-[12px] border-white ring-1 ring-slate-800">
                            {/* Placeholder for Preview */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 text-center px-10">
                                <ScanSearch size={48} className="mb-4 opacity-50" />
                                <p className="text-sm font-bold text-slate-900">Náhľad zatiaľ nie je vygenerovaný</p>
                                <p className="text-[10px] uppercase tracking-widest mt-2">Kliknite na 'Generovať náhľad'</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
