"use client";

import { Circle } from "lucide-react";

interface AppHeaderProps {
    title: string;
}

export default function AppHeader({ title }: AppHeaderProps) {
    return (
        <header className="flex justify-between items-center mb-8">
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    AutoDesign Cloud System
                </p>
                <h1 className="text-3xl font-black text-slate-900">{title}</h1>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-100">
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-xs font-bold text-slate-600">Agent Online (Mac-Office)</span>
            </div>
        </header>
    );
}
