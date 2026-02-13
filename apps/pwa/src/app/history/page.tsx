"use client";

import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import {
    History,
    ExternalLink,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Printer,
    Trash2,
    Archive
} from "lucide-react";
import Link from 'next/link';

export default function HistoryPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                // Fetch completed, in-print, trash, and failed orders
                // Using limit=50 to see more history
                const res = await fetch('/api/woo/orders?limit=50&status=completed,in_print,trash,failed,cancelled');
                const data = await res.json();
                if (data.success) {
                    setOrders(data.orders);
                } else {
                    setError(data.error || "Failed to load history");
                }
            } catch (e) {
                console.error("Failed to fetch order history", e);
                setError("Nepodarilo sa načítať históriu.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const getStatusBadge = (status: string) => {
        const s = (status || '').toLowerCase();
        if (s === 'completed') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><CheckCircle2 size={12} /> DOKONČENÉ</span>;
        if (s === 'in_print' || s === 'in-print') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700"><Printer size={12} /> V TLAČI</span>;
        if (s === 'trash') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700"><Trash2 size={12} /> KÔŠ</span>;
        if (s === 'failed' || s === 'cancelled') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><AlertCircle size={12} /> ZRUŠENÉ</span>;

        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 uppercase">{s}</span>;
    };

    return (
        <div className="pb-20">
            <AppHeader title="História objednávok" />

            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <History className="text-blue-500" size={20} />
                        <h2 className="text-lg font-bold text-slate-900">Vybavené objednávky</h2>
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-24 text-center text-slate-400">
                        <Loader2 className="mx-auto mb-4 animate-spin text-blue-500" size={48} />
                        <p className="font-bold">Načítavam históriu...</p>
                    </div>
                ) : error ? (
                    <div className="p-12 text-center text-red-500">
                        <AlertCircle className="mx-auto mb-4" size={48} />
                        <p className="font-bold">{error}</p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="p-24 text-center text-slate-400">
                        <Archive size={64} className="mx-auto mb-4 opacity-10" />
                        <h3 className="text-xl font-black text-slate-900">Žiadne záznamy</h3>
                        <p className="text-sm font-medium">Zatiaľ nie sú žiadne vybavené objednávky.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/30">
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Náhľad</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID / Zdroj</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zákazník</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Položka</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Akcia</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                                        {/* Thumbnail */}
                                        <td className="px-6 py-4 w-20">
                                            <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center relative group-hover:shadow-md transition-all">
                                                {order.preview ? (
                                                    <img src={order.preview} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-dashed animate-spin-slow opacity-20" />
                                                )}
                                            </div>
                                        </td>

                                        {/* ID / Source */}
                                        <td className="px-6 py-4">
                                            <div>
                                                <span className="text-lg font-black text-slate-900 block">#{order.id}</span>
                                                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest truncate max-w-[120px] block">
                                                    POZVÁNKA NA OSLAVU
                                                </span>
                                            </div>
                                        </td>

                                        {/* Customer */}
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700">{order.billing?.first_name} {order.billing?.last_name || "Bez mena"}</span>
                                            </div>
                                        </td>

                                        {/* Item */}
                                        <td className="px-6 py-4 max-w-[300px]">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-900 truncate block">
                                                    {order.line_items?.[0]?.name || "Neznáma položka"}
                                                </span>
                                                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-1">
                                                    {order.line_items?.[0]?.template_key || "No Template"}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-6 py-4">
                                            {getStatusBadge(order.status)}
                                        </td>

                                        {/* Action */}
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                href={`/orders/${order.id}`}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-all shadow-lg shadow-slate-200 hover:shadow-blue-200"
                                            >
                                                Otvoriť <ExternalLink size={12} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
