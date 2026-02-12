"use client";

import AppHeader from "@/components/AppHeader";
import { History } from "lucide-react";

export default function HistoryPage() {
    return (
        <div>
            <AppHeader title="História" />
            <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
                <div className="p-6 bg-slate-100 rounded-3xl mb-4 text-slate-300">
                    <History size={64} />
                </div>
                <h3 className="text-xl font-black text-slate-900">História spracovania</h3>
                <p className="text-sm font-medium">Archív dokončených a exportovaných objednávok.</p>
            </div>
        </div>
    );
}
