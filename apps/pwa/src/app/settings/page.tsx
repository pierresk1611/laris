"use client";

import AppHeader from "@/components/AppHeader";
import {
    Globe,
    Key,
    Database,
    Cpu,
    Terminal,
    Save
} from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('general');

    const tabs = [
        { id: 'general', label: 'Všeobecné', icon: Globe },
        { id: 'api', label: 'API Kľúče', icon: Key },
        { id: 'agent', label: 'Local Agent', icon: Terminal },
        { id: 'db', label: 'Databáza', icon: Database },
    ];

    return (
        <div>
            <AppHeader title="Nastavenia" />

            {/* Tabs */}
            <div className="bg-slate-100 p-1.5 rounded-2xl inline-flex gap-1 mb-10">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${isActive
                                    ? "bg-white text-blue-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                                }`}
                        >
                            <Icon size={16} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* API Keys Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                            <Key className="text-blue-500" size={20} />
                            <span>Externé Služby</span>
                        </h2>
                    </div>
                    <div className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">OpenAI API Key</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    defaultValue="sk-proj-**********************"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Dropbox Access Token</label>
                            <input
                                type="password"
                                defaultValue="sl.**********************"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* WooCommerce Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                            <Globe className="text-blue-500" size={20} />
                            <span>WooCommerce (WP Connector)</span>
                        </h2>
                    </div>
                    <div className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Store URL</label>
                            <input
                                type="text"
                                placeholder="https://vasha-stranka.sk"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Consumer Key</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Consumer Secret</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Agent Config */}
                <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden md:col-span-2">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                        <h2 className="text-lg font-bold text-white flex items-center gap-3">
                            <Terminal className="text-blue-400" size={20} />
                            <span>Konfigurácia Lokálneho Agenta</span>
                        </h2>
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="text-[10px] font-bold text-green-400 uppercase">Pripojený</span>
                        </div>
                    </div>
                    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Agent Access Token</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    readOnly
                                    value="AGT-8822-XP91-LRS0"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm outline-none"
                                />
                                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-400 uppercase tracking-widest hover:text-blue-300">
                                    Kopírovať
                                </button>
                            </div>
                            <p className="text-[9px] text-slate-500 mt-2 px-1">
                                Tento kľúč použite v súbore .env vášho lokálneho agenta.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Polling Interval (ms)</label>
                            <input
                                type="number"
                                defaultValue={5000}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div className="flex items-end">
                            <button className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
                                Uložiť Konfiguráciu
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-end">
                <button className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-xl">
                    <Save size={18} />
                    <span>Uložiť všetky zmeny</span>
                </button>
            </div>
        </div>
    );
}
