"use client";

import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import { FileText, Search, Filter, ExternalLink, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function OrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const res = await fetch('/api/woo/orders');
                const data = await res.json();
                if (data.success) {
                    setOrders(data.orders);
                } else {
                    setError(data.error);
                }
            } catch (e) {
                setError("Chyba pripojenia k API.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, []);

    return (
        <div className="pb-20">
            <AppHeader title="Všetky objednávky" />

            <div className="flex justify-between items-center mb-8">
                <div className="relative w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Hľadať objednávku..."
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                    />
                </div>
                <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm">
                    <Filter size={18} />
                    <span>Filtrovať</span>
                </button>
            </div>

            {isLoading ? (
                <div className="bg-white rounded-3xl border border-slate-100 p-24 text-center text-slate-400">
                    <Clock size={48} className="mx-auto mb-4 opacity-20 animate-spin" />
                    <p className="font-bold">Načítavam objednávky...</p>
                </div>
            ) : error ? (
                <div className="bg-white rounded-3xl border border-red-100 p-24 text-center text-red-500">
                    <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="font-bold">Chyba pri načítaní</p>
                    <p className="text-sm opacity-70">{error}</p>
                </div>
            ) : orders.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 p-24 text-center text-slate-400">
                    <FileText size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-bold">Žiadne objednávky nenájdené</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orders.map((order) => (
                        <Link
                            key={order.id}
                            href={`/orders/${order.id}`}
                            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">#{order.number}</h3>
                                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                                        {order.shopName || 'E-shop'}
                                    </p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${order.status === 'processing' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
                                    }`}>
                                    {order.status}
                                </span>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400 font-medium">Zákazník:</span>
                                    <span className="text-slate-900 font-bold">{order.customer}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400 font-medium">Položiek:</span>
                                    <span className="text-slate-900 font-bold">{order.items?.length || 0}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400 font-medium">Celkom:</span>
                                    <span className="text-slate-900 font-bold text-lg">{order.total} {order.currency}</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {new Date(order.date).toLocaleDateString('sk-SK')}
                                </span>
                                <div className="p-2 bg-slate-50 group-hover:bg-blue-600 group-hover:text-white rounded-xl transition-colors">
                                    <ExternalLink size={16} />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
