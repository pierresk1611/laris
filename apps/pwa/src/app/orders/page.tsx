"use strict";
"use client";

import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import { FileText, Search, Filter, ExternalLink, Clock, AlertCircle, ShoppingBag, CheckCircle } from "lucide-react";
import Link from "next/link";

interface Shop {
    id: string;
    name: string;
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [shops, setShops] = useState<Shop[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [selectedShopId, setSelectedShopId] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch Shops
                const shopsRes = await fetch('/api/shops');
                const shopsData = await shopsRes.json();

                if (!shopsData.success) throw new Error("Nepodarilo sa načítať e-shopy.");
                setShops(shopsData.shops || []);

                // 2. Fetch Orders from ALL shops in parallel
                const shopList = shopsData.shops || [];
                const orderPromises = shopList.map((shop: Shop) =>
                    fetch(`/api/woo/orders?shopId=${shop.id}&limit=30`).then(r => r.json())
                );

                const results = await Promise.all(orderPromises);

                let allOrders: any[] = [];
                results.forEach((res: any) => {
                    if (res.success && Array.isArray(res.orders)) {
                        allOrders = [...allOrders, ...res.orders];
                    }
                });

                // Sort by date desc
                allOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                setOrders(allOrders);
            } catch (e: any) {
                console.error("Fetch error:", e);
                setError(e.message || "Chyba pripojenia.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // --- Filtering Logic ---
    const filteredOrders = orders.filter(order => {
        // 1. Shop Filter
        if (selectedShopId !== 'all' && order.shopId !== selectedShopId) return false;

        // 2. Status Filter
        if (statusFilter === 'active') {
            const ignoredStatuses = ['completed', 'trash', 'failed', 'in_print', 'checkout-draft', 'cancelled', 'refunded'];
            if (ignoredStatuses.includes(order.status)) return false;
        }

        // 3. Search Filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchNumber = order.number.toLowerCase().includes(q);
            const matchCustomer = order.customer.toLowerCase().includes(q);
            if (!matchNumber && !matchCustomer) return false;
        }

        return true;
    });

    return (
        <div className="pb-20">
            <AppHeader title="Objednávky" />

            {/* Shop Tabs */}
            <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setSelectedShopId('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors border ${selectedShopId === 'all'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                >
                    Všetky E-shopy
                </button>
                {shops.map(shop => (
                    <button
                        key={shop.id}
                        onClick={() => setSelectedShopId(shop.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors border ${selectedShopId === shop.id
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        {shop.name}
                    </button>
                ))}
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                {/* Search */}
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Hľadať objednávku..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                    />
                </div>

                {/* Status Filter Toggle */}
                <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                    <button
                        onClick={() => setStatusFilter('active')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${statusFilter === 'active'
                                ? 'bg-orange-100 text-orange-700 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <Clock size={16} />
                        Nespracované
                    </button>
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${statusFilter === 'all'
                                ? 'bg-slate-100 text-slate-700 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <ShoppingBag size={16} />
                        Všetky
                    </button>
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="bg-white rounded-3xl border border-slate-100 p-24 text-center text-slate-400">
                    <Clock size={48} className="mx-auto mb-4 opacity-20 animate-spin" />
                    <p className="font-bold">Načítavam objednávky zo všetkých zdrojov...</p>
                </div>
            ) : error ? (
                <div className="bg-white rounded-3xl border border-red-100 p-24 text-center text-red-500">
                    <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="font-bold">Chyba pri načítaní</p>
                    <p className="text-sm opacity-70">{error}</p>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 p-24 text-center text-slate-400">
                    <div className="flex justify-center gap-2 mb-4">
                        <FileText size={48} className="opacity-20" />
                        {statusFilter === 'active' && <CheckCircle size={48} className="opacity-20 text-green-500" />}
                    </div>
                    <p className="font-bold">Žiadne objednávky nenájdené</p>
                    <p className="text-sm">Skúste zmeniť filter alebo hľadanie.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredOrders.map((order) => (
                        <Link
                            key={`${order.shopId}-${order.id}`} // Composite key as IDs might collide across shops
                            href={`/orders/${order.id}?shopId=${order.shopId}`} // Pass shopId to detail
                            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">#{order.number}</h3>
                                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1">
                                        <ShoppingBag size={10} />
                                        {order.shopName || 'E-shop'}
                                    </p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${order.status === 'processing' ? 'bg-orange-50 text-orange-600' :
                                        order.status === 'completed' ? 'bg-green-50 text-green-600' :
                                            'bg-slate-50 text-slate-600'
                                    }`}>
                                    {order.status}
                                </span>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400 font-medium">Zákazník:</span>
                                    <span className="text-slate-900 font-bold truncate max-w-[150px] text-right">{order.customer}</span>
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
