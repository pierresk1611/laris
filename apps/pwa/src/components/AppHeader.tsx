"use client";

import { Circle } from "lucide-react";
import { useState, useEffect } from "react";

interface AppHeaderProps {
    title: string;
}

export default function AppHeader({ title }: AppHeaderProps) {
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/agent/heartbeat');
                const data = await res.json();
                setIsOnline(data.online);
            } catch (e) {
                setIsOnline(false);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 10000); // Check every 10s
        return () => clearInterval(interval);
    }, []);

    return (
        <header className="flex justify-between items-center mb-8">
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    AutoDesign Cloud System
                </p>
                <h1 className="text-3xl font-black text-slate-900">{title}</h1>
            </div>

            <div className={`flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border ${isOnline ? 'border-green-100' : 'border-slate-100'}`}>
                {isOnline ? (
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                ) : (
                    <span className="h-3 w-3 rounded-full bg-slate-200"></span>
                )}
                <span className={`text-xs font-bold ${isOnline ? 'text-green-600' : 'text-slate-400'}`}>
                    {isOnline ? 'Agent Live (Mac-Office)' : 'Agent Offline'}
                </span>
            </div>
        </header>
    );
}
