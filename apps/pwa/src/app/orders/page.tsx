"use client";

import AppHeader from "@/components/AppHeader";
import { FileText, Search, Filter } from "lucide-react";

export default function OrdersPage() {
    return (
        <div>
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

            <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-400">
                <FileText size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold">Zoznam objednávok sa načítava...</p>
            </div>
        </div>
    );
}
