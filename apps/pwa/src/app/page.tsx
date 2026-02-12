"use client";

import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import {
  ScanSearch,
  Cpu,
  Clock,
  AlertCircle,
  ExternalLink
} from "lucide-react";

const stats = [
  { label: "Nové objednávky", value: "12", icon: ScanSearch, color: "text-blue-600" },
  { label: "AI Spracováva", value: "5", icon: Cpu, color: "text-purple-600" },
  { label: "Čaká na kontrolu", value: "8", icon: Clock, color: "text-orange-600" },
  { label: "Chyby", value: "2", icon: AlertCircle, color: "text-red-600" },
];

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
  return (
    <div>
      <AppHeader title="Prehľad" />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
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
          <Link href="/orders" className="text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider">
            Zobraziť všetko
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16">Náhľad</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID / Zdroj</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zákazník</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ks</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Šablóna</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stav AI</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Akcia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mockOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="w-10 h-10 bg-slate-200 rounded-lg overflow-hidden border border-slate-200">
                      <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400 font-bold uppercase">Image</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{order.id}</span>
                      <span className="text-[10px] font-bold text-blue-500 uppercase">{order.shop}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">{order.customer}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-700">
                      {order.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600 uppercase">
                      {order.template}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${order.aiStatus === 'PARSED' ? 'bg-green-500' : order.aiStatus === 'FAILED' ? 'bg-red-500' : 'bg-orange-400'}`} />
                      <span className="text-sm font-medium text-slate-600">{order.aiStatus}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/orders/${order.id.replace('#', '')}`} className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">
                      <span>Skontrolovať</span>
                      <ExternalLink size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
