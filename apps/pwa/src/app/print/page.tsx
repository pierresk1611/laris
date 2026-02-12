"use client";

import AppHeader from "@/components/AppHeader";
import { Printer } from "lucide-react";

export default function PrintManagerPage() {
    return (
        <div>
            <AppHeader title="Print Manager" />
            <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
                <div className="p-6 bg-slate-100 rounded-3xl mb-4 text-slate-300">
                    <Printer size={64} />
                </div>
                <h3 className="text-xl font-black text-slate-900">Správa tlače</h3>
                <p className="text-sm font-medium">Táto sekcia je v súčasnosti vo vývoji.</p>
            </div>
        </div>
    );
}
