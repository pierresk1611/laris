"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import {
  ScanSearch,
  Cpu,
  Clock,
  AlertCircle,
  ExternalLink
} from "lucide-react";

const mockOrders = [
  {
    id: "#4532",
    customer: "Jana M.",
    template: "JSO 15",
    aiStatus: "PARSED",
    status: "READY_FOR_PRINT",
    shop: "Svadobky.sk",
    quantity: 50,
    preview: "/placeholder-item.jpg"
  },
  {
    id: "#4531",
    customer: "Marek K.",
    template: "VSO 02",
    aiStatus: "PENDING",
    status: "PROCESSING",
    shop: "MirkaDesign.cz",
    quantity: 20,
    preview: "/placeholder-item.jpg"
  },
  {
    id: "#4530",
    customer: "Anna B.",
    template: "JSO 22",
    aiStatus: "FAILED",
    status: "ERROR",
    shop: "Svadobky.sk",
    quantity: 100,
    preview: "/placeholder-item.jpg"
  },
];

export default function Dashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch('/api/woo/orders');
        const data = await res.json();
        if (data.success) {
          setOrders(data.orders);
        } else {
          setError(data.error);
          (window as any)._lastErrorDetails = data.details || data.error_stack || "No additional details";
        }
      } catch (e) {
        setError("Nepodarilo sa pripojiť k e-shopu.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, []);

  // Shared Logic for Status Checking (Refined for Active Workflow)
  const checkStatus = (order: any, key: string) => {
    const s = (order.status || '').toLowerCase().trim();

    // "Active" View (Default): Hides completed, in_print, and drafts
    if (key === 'all') {
      const activeStatuses = ['processing', 'ai_processing', 'pending', 'on-hold', 'failed', 'error'];
      return activeStatuses.includes(s);
    }

    // AI Processing: Only things actually being processed by AI or Waiting for AI
    if (key === 'processing') {
      return s === 'processing' || s === 'ai_processing';
    }

    // Pending: Waiting for user/admin action (Hiding checkout-draft as per user feedback "ghost orders")
    if (key === 'pending') {
      return s === 'pending' || s === 'on-hold';
    }

    // Errors
    if (key === 'error') {
      return s === 'failed' || s === 'cancelled' || s === 'error';
    }

    return false;
  };

  // Calculate dynamic counts
  const counts = {
    all: orders.filter(o => checkStatus(o, 'all')).length,
    processing: orders.filter(o => checkStatus(o, 'processing')).length,
    pending: orders.filter(o => checkStatus(o, 'pending')).length,
    error: orders.filter(o => checkStatus(o, 'error')).length
  };

  const stats = [
    { label: "Nové objednávky", value: counts.all, icon: ScanSearch, color: "text-blue-600", filterKey: "all", ringColor: "ring-blue-500" },
    { label: "AI Spracováva", value: counts.processing, icon: Cpu, color: "text-purple-600", filterKey: "processing", ringColor: "ring-purple-500" },
    { label: "Čaká na kontrolu", value: counts.pending, icon: Clock, color: "text-orange-600", filterKey: "pending", ringColor: "ring-orange-500" },
    { label: "Chyby", value: counts.error, icon: AlertCircle, color: "text-red-600", filterKey: "error", ringColor: "ring-red-500" },
  ];

  // Filter logic
  const filteredOrders = orders.filter(order => checkStatus(order, filterStatus));

  return (
    <div>
      <AppHeader title="Prehľad" />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isActive = filterStatus === stat.filterKey;

          return (
            <div
              key={stat.label}
              onClick={() => setFilterStatus(stat.filterKey)}
              className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all cursor-pointer ${isActive ? `ring-2 ${stat.ringColor} ring-offset-2` : ''}`}
            >
              <div className={`absolute top-0 left-0 w-1 h-full ${stat.color.replace('text', 'bg')}`} />
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-slate-50 group-hover:scale-110 transition-transform`}>
                  <Icon className={stat.color} size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Orders Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900">Aktuálne fronty</h2>
          <div className="flex items-center gap-2">
            {filterStatus !== 'all' && (
              <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase">
                Filter: {filterStatus}
              </span>
            )}
            <Link href="/orders" className="text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider">
              Zobraziť všetko
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="animate-spin mb-4 inline-block text-blue-600">
              <Clock size={32} />
            </div>
            <p className="font-bold">Načítavam dáta z e-shopu...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-400">
            <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
            <p className="font-bold">Chyba pripojenia</p>
            <p className="text-sm font-medium text-red-500/80 mb-2">{error}</p>
            {/* Show extra details if we have them */}
            {(window as any)._lastErrorDetails && (
              <p className="text-[10px] text-red-400 opacity-70 max-w-md mx-auto bg-red-50 p-2 rounded-lg border border-red-100">
                {(window as any)._lastErrorDetails}
              </p>
            )}
            <Link href="/settings" className="mt-4 inline-block text-xs font-bold text-blue-600 uppercase underline">Skontrolovať API kľúče</Link>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ScanSearch size={48} className="mx-auto mb-4 opacity-10" />
            <p className="font-bold">{orders.length > 0 ? "Žiadne objednávky pre tento filter" : "Žiadne nové objednávky"}</p>
            {orders.length > 0 && (
              <button onClick={() => setFilterStatus('all')} className="mt-2 text-sm text-blue-500 font-bold underline">Zrušiť filter</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16">Náhľad</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID / Zdroj</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zákazník</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ks</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Položka</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Akcia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center">
                        <ScanSearch size={16} className="text-slate-300" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">#{order.number}</span>
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter truncate w-24">
                          {order.shopName || 'E-shop'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{order.customer}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-700">
                        {order.items?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-[200px]">
                        <p className="text-xs font-bold text-slate-900 truncate">{order.items?.[0]?.name || 'Neznáma položka'}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {order.items?.[0]?.templateKey && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase border border-blue-100">
                              {order.items[0].templateKey}
                            </span>
                          )}
                          {order.items?.[0]?.material && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold uppercase">
                              {order.items[0].material}
                            </span>
                          )}
                          {order.items?.[0]?.hasInvitation && (
                            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[9px] font-bold uppercase border border-purple-100">
                              + Pozvánka
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${order.status === 'processing' ? 'bg-orange-400' : 'bg-green-500'}`} />
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{order.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/orders/${order.id}`} className="inline-flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm">
                        <span>Otvoriť</span>
                        <ExternalLink size={14} />
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
