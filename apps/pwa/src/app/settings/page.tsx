"use client";

import AppHeader from "@/components/AppHeader";
import {
    Globe,
    Key,
    Database,
    Cpu,
    Terminal,
    Save,
    Plus,
    Trash2
} from "lucide-react";
import { useState, useEffect } from "react";

interface Shop {
    id: string;
    url: string;
    ck: string;
    cs: string;
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('general');
    const [shops, setShops] = useState<Shop[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Initial load from localStorage
    useEffect(() => {
        const savedShops = localStorage.getItem('laris_shops');
        if (savedShops) {
            try {
                setShops(JSON.parse(savedShops));
            } catch (e) {
                console.error("Failed to parse shops", e);
            }
        } else {
            // Default initial shops if none saved
            setShops([
                { id: '1', url: 'https://svadobky.sk', ck: 'ck_**********', cs: 'cs_**********' },
                { id: '2', url: 'https://mirkadesign.cz', ck: 'ck_**********', cs: 'cs_**********' }
            ]);
        }
        setIsLoaded(true);
    }, []);

    // Save to localStorage whenever shops change
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('laris_shops', JSON.stringify(shops));
        }
    }, [shops, isLoaded]);

    const addShop = () => {
        const newShop: Shop = {
            id: Date.now().toString(),
            url: '',
            ck: '',
            cs: ''
        };
        setShops([...shops, newShop]);
    };

    const removeShop = (id: string) => {
        setShops(shops.filter(s => s.id !== id));
    };

    const updateShop = (id: string, field: keyof Shop, value: string) => {
        setShops(shops.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

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

                {/* Stores Management */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden md:col-span-2">
                    <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                            <Globe className="text-blue-500" size={20} />
                            <span>Prepojené E-shopy (WooCommerce)</span>
                        </h2>
                        <button
                            onClick={addShop}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors"
                        >
                            <Plus size={14} />
                            <span>Pridať ďalší e-shop</span>
                        </button>
                    </div>
                    <div className="p-8 space-y-8">
                        {shops.map((shop) => (
                            <div key={shop.id} className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                                <button
                                    onClick={() => removeShop(shop.id)}
                                    className="absolute top-4 right-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Store Name / URL</label>
                                    <input
                                        type="text"
                                        value={shop.url}
                                        onChange={(e) => updateShop(shop.id, 'url', e.target.value)}
                                        placeholder="https://vasha-stranka.sk"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Consumer Key</label>
                                    <input
                                        type="password"
                                        value={shop.ck}
                                        onChange={(e) => updateShop(shop.id, 'ck', e.target.value)}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Consumer Secret</label>
                                    <input
                                        type="password"
                                        value={shop.cs}
                                        onChange={(e) => updateShop(shop.id, 'cs', e.target.value)}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        ))}
                        {shops.length === 0 && (
                            <div className="text-center py-12 text-slate-400">
                                <Globe size={48} className="mx-auto mb-4 opacity-10" />
                                <p className="font-bold">Žiadne prepojené e-shopy</p>
                                <p className="text-sm">Kliknite na "Pridať ďalší e-shop" pre začatie.</p>
                            </div>
                        )}
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
