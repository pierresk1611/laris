"use client";

import AppHeader from "@/components/AppHeader";
import { useState, useEffect } from "react";
import {
    Globe,
    Key,
    Monitor,
    Database,
    Plus,
    Save,
    Trash2,
    CheckCircle2,
    AlertCircle,
    RotateCw,
    FileText,
    UploadCloud,
    Loader2
} from "lucide-react";

interface Shop {
    id: string;
    name: string;
    url: string;
    ck: string;
    cs: string;
}

interface Setting {
    id: string;
    value: string;
    category: string;
    isSecret: boolean;
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'shops' | 'api' | 'agent' | 'db'>('shops');
    const [shops, setShops] = useState<Shop[]>([]);
    const [settings, setSettings] = useState<Setting[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [stats, setStats] = useState<any>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data.success) {
                setShops(data.shops || []);
                setSettings(data.settings || []);
                setStats({ patternCount: data.patternCount });
            }
        } catch (e) {
            console.error("Failed to fetch settings", e);
        } finally {
            setLoading(false);
        }
    };

    const handleExportDataset = () => {
        window.location.href = '/api/settings/export-patterns';
    };

    const handleSaveShop = async (shop: Shop) => {
        setSaving(`shop-${shop.id || 'new'}`);
        try {
            const res = await fetch('/api/settings/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'SHOP', data: shop })
            });
            const result = await res.json();
            if (result.success) {
                alert("E-shop úspešne uložený");
                fetchSettings();
            } else {
                alert("Chyba: " + (result.error || "Neznáma chyba servera"));
            }
        } catch (e: any) {
            console.error("Shop save error:", e);
            alert("Chyba pri ukladaní: " + e.message);
        } finally {
            setSaving(null);
        }
    };

    const handleSaveSetting = async (id: string, value: string, category: string, isSecret: boolean) => {
        setSaving(id);
        const correlationId = Math.random().toString(36).substring(7);
        try {
            console.log(`[SettingsPage:${correlationId}] Attempting to save setting: ${id}`);
            const res = await fetch('/api/settings/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'SETTING',
                    data: { id, value, category, isSecret }
                })
            });

            const result = await res.json();

            if (res.ok && result.success) {
                alert("Nastavenie úspešne uložené ✅");
                fetchSettings();
            } else {
                const errorInfo = result.error || "Neznáma chyba";
                const stackInfo = result.stack ? `\n\nTECHNICAL DETAILS:\n${result.stack}` : '';
                console.error(`[SettingsPage:${correlationId}] Save failed:`, result);
                alert(`CHYBA PRI UKLADANÍ (Ref: ${correlationId})\n\nSpráva: ${errorInfo}${stackInfo}`);
            }
        } catch (e: any) {
            console.error(`[SettingsPage:${correlationId}] Connection error:`, e);
            alert(`CHYBA PRIPOJENIA k serveru (Ref: ${correlationId})\n\n${e.message}`);
        } finally {
            setSaving(null);
        }
    };

    const handleImportCatalog = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', e.target.files[0]);

        try {
            const res = await fetch('/api/catalog/import', { method: 'POST', body: formData });
            const result = await res.json();
            if (result.success) {
                alert(result.message);
                fetchSettings();
            } else {
                alert("Import zlyhal: " + result.message);
            }
        } catch (err) {
            alert("Chyba spojenia.");
        } finally {
            setUploading(false);
            e.target.value = ""; // Reset file input
        }
    };

    const testConnection = async (shop: Shop) => {
        setSaving(`test-${shop.id}`);
        try {
            const res = await fetch('/api/settings/test-woo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: shop.url, ck: shop.ck, cs: shop.cs, shopId: shop.id })
            });
            const result = await res.json();
            if (result.success) {
                alert(`✅ Spojenie úspešné! (WooCommerce v${result.version})`);
            } else {
                alert(`❌ Spojenie zlyhalo: ${result.error}`);
            }
        } catch (e) {
            alert("❌ Chyba pri teste spojenia");
        } finally {
            setSaving(null);
        }
    };

    const getSettingValue = (id: string) => settings.find(s => s.id === id)?.value || "";

    if (loading) return <div className="p-8 text-center text-slate-500">Načítavam nastavenia...</div>;

    return (
        <main className="min-h-screen bg-slate-50 p-8">
            <AppHeader title="Nastavenia Systému" />

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-8 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit">
                <button
                    onClick={() => setActiveTab('shops')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'shops' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    <Globe size={18} />
                    Všeobecné (E-shopy)
                </button>
                <button
                    onClick={() => setActiveTab('api')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'api' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    <Key size={18} />
                    API Kľúče
                </button>
                <button
                    onClick={() => setActiveTab('agent')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'agent' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    <Monitor size={18} />
                    Local Agent
                </button>
                <button
                    onClick={() => setActiveTab('db')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'db' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    <Database size={18} />
                    Databáza
                </button>
            </div>

            {/* TAB 1: SHOPS */}
            {activeTab === 'shops' && (
                <div className="space-y-6">
                    {shops.map((shop, idx) => (
                        <div key={shop.id || idx} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <Globe size={16} className="text-blue-500" />
                                    {shop.name || "Nový E-shop"}
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => testConnection(shop)}
                                        disabled={saving !== null}
                                        className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                    >
                                        {saving === `test-${shop.id}` ? "Testujem..." : "Testovať spojenie"}
                                    </button>
                                    <button
                                        onClick={() => handleSaveShop(shop)}
                                        disabled={saving !== null}
                                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
                                    >
                                        {saving === `shop-${shop.id}` ? "Ukladám..." : "Uložiť e-shop"}
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Názov e-shopu</label>
                                        <input
                                            type="text"
                                            value={shop.name}
                                            onChange={(e) => {
                                                const newShops = [...shops];
                                                newShops[idx].name = e.target.value;
                                                setShops(newShops);
                                            }}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">URL Doména</label>
                                        <input
                                            type="text"
                                            value={shop.url}
                                            onChange={(e) => {
                                                const newShops = [...shops];
                                                newShops[idx].url = e.target.value;
                                                setShops(newShops);
                                            }}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                            placeholder="https://www.vas-shop.sk"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Consumer Key</label>
                                        <input
                                            type="text"
                                            value={shop.ck}
                                            onChange={(e) => {
                                                const newShops = [...shops];
                                                newShops[idx].ck = e.target.value;
                                                setShops(newShops);
                                            }}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Consumer Secret</label>
                                        <input
                                            type="text"
                                            value={shop.cs}
                                            onChange={(e) => {
                                                const newShops = [...shops];
                                                newShops[idx].cs = e.target.value;
                                                setShops(newShops);
                                            }}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    <button
                        onClick={() => setShops([...shops, { id: "", name: "", url: "", ck: "", cs: "" }])}
                        className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-bold text-sm hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={20} />
                        Pridať ďalší e-shop
                    </button>
                </div>
            )}

            {/* TAB 2: API KEYS */}
            {activeTab === 'api' && (
                <div className="grid grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                            <RotateCw size={24} className="text-blue-400" />
                            AI Modely
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Groq API Key</label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={getSettingValue('GROQ_API_KEY')}
                                        onChange={(e) => {
                                            const newSettings = [...settings];
                                            const idx = newSettings.findIndex(s => s.id === 'GROQ_API_KEY');
                                            if (idx !== -1) newSettings[idx].value = e.target.value;
                                            else newSettings.push({ id: 'GROQ_API_KEY', value: e.target.value, category: 'AI', isSecret: true });
                                            setSettings(newSettings);
                                        }}
                                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                        placeholder="gsk_..."
                                    />
                                    <button
                                        onClick={() => handleSaveSetting('GROQ_API_KEY', getSettingValue('GROQ_API_KEY'), 'AI', true)}
                                        disabled={saving === 'GROQ_API_KEY'}
                                        className="px-6 bg-slate-900 text-white rounded-xl font-bold text-xs"
                                    >
                                        Uložiť
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">OpenAI API Key (Záložný)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={getSettingValue('OPENAI_API_KEY')}
                                        onChange={(e) => {
                                            const newSettings = [...settings];
                                            const idx = newSettings.findIndex(s => s.id === 'OPENAI_API_KEY');
                                            if (idx !== -1) newSettings[idx].value = e.target.value;
                                            else newSettings.push({ id: 'OPENAI_API_KEY', value: e.target.value, category: 'AI', isSecret: true });
                                            setSettings(newSettings);
                                        }}
                                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                        placeholder="sk-..."
                                    />
                                    <button
                                        onClick={() => handleSaveSetting('OPENAI_API_KEY', getSettingValue('OPENAI_API_KEY'), 'AI', true)}
                                        disabled={saving === 'OPENAI_API_KEY'}
                                        className="px-6 bg-slate-900 text-white rounded-xl font-bold text-xs"
                                    >
                                        Uložiť
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                            <Database size={24} className="text-blue-400" />
                            Dropbox Úložisko
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Dropbox Priečinok (Path)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={getSettingValue('DROPBOX_FOLDER_PATH')}
                                        onChange={(e) => {
                                            const newSettings = [...settings];
                                            const idx = newSettings.findIndex(s => s.id === 'DROPBOX_FOLDER_PATH');
                                            if (idx !== -1) newSettings[idx].value = e.target.value;
                                            else newSettings.push({ id: 'DROPBOX_FOLDER_PATH', value: e.target.value, category: 'STORAGE', isSecret: false });
                                            setSettings(newSettings);
                                        }}
                                        placeholder="/TEMPLATES"
                                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                    />
                                    <button
                                        onClick={() => handleSaveSetting('DROPBOX_FOLDER_PATH', getSettingValue('DROPBOX_FOLDER_PATH'), 'STORAGE', false)}
                                        disabled={saving === 'DROPBOX_FOLDER_PATH'}
                                        className="px-6 bg-slate-900 text-white rounded-xl font-bold text-xs"
                                    >
                                        Uložiť
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2 block">Dočasný Access Token (Testovací)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={getSettingValue('DROPBOX_ACCESS_TOKEN')}
                                        onChange={(e) => {
                                            const newSettings = [...settings];
                                            const idx = newSettings.findIndex(s => s.id === 'DROPBOX_ACCESS_TOKEN');
                                            if (idx !== -1) newSettings[idx].value = e.target.value;
                                            else newSettings.push({ id: 'DROPBOX_ACCESS_TOKEN', value: e.target.value, category: 'STORAGE', isSecret: true });
                                            setSettings(newSettings);
                                        }}
                                        placeholder="Kód začínajúci na sl.u..."
                                        className="flex-1 px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-xl text-sm"
                                    />
                                    <button
                                        onClick={() => handleSaveSetting('DROPBOX_ACCESS_TOKEN', getSettingValue('DROPBOX_ACCESS_TOKEN'), 'STORAGE', true)}
                                        disabled={saving === 'DROPBOX_ACCESS_TOKEN'}
                                        className="px-6 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                                    >
                                        Testovať
                                    </button>
                                </div>
                                <p className="text-[9px] text-slate-400 mt-1">
                                    * POZOR: Tento kód expiruje po 4 hodinách. Pre trvalé riešenie vyplňte polia nižšie.
                                </p>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Dropbox Refresh Token (Trvalý)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={getSettingValue('DROPBOX_REFRESH_TOKEN')}
                                        onChange={(e) => {
                                            const newSettings = [...settings];
                                            const idx = newSettings.findIndex(s => s.id === 'DROPBOX_REFRESH_TOKEN');
                                            if (idx !== -1) newSettings[idx].value = e.target.value;
                                            else newSettings.push({ id: 'DROPBOX_REFRESH_TOKEN', value: e.target.value, category: 'STORAGE', isSecret: true });
                                            setSettings(newSettings);
                                        }}
                                        placeholder="Trvalý prístupový kód..."
                                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                    />
                                    <button
                                        onClick={() => handleSaveSetting('DROPBOX_REFRESH_TOKEN', getSettingValue('DROPBOX_REFRESH_TOKEN'), 'STORAGE', true)}
                                        disabled={saving === 'DROPBOX_REFRESH_TOKEN'}
                                        className="px-6 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-colors"
                                    >
                                        Uložiť
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Dropbox App Key</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            value={getSettingValue('DROPBOX_APP_KEY')}
                                            onChange={(e) => {
                                                const newSettings = [...settings];
                                                const idx = newSettings.findIndex(s => s.id === 'DROPBOX_APP_KEY');
                                                if (idx !== -1) newSettings[idx].value = e.target.value;
                                                else newSettings.push({ id: 'DROPBOX_APP_KEY', value: e.target.value, category: 'STORAGE', isSecret: true });
                                                setSettings(newSettings);
                                            }}
                                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                        />
                                        <button
                                            onClick={() => handleSaveSetting('DROPBOX_APP_KEY', getSettingValue('DROPBOX_APP_KEY'), 'STORAGE', true)}
                                            disabled={saving === 'DROPBOX_APP_KEY'}
                                            className="p-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl font-bold text-xs"
                                        >
                                            <Save size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Dropbox App Secret</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            value={getSettingValue('DROPBOX_APP_SECRET')}
                                            onChange={(e) => {
                                                const newSettings = [...settings];
                                                const idx = newSettings.findIndex(s => s.id === 'DROPBOX_APP_SECRET');
                                                if (idx !== -1) newSettings[idx].value = e.target.value;
                                                else newSettings.push({ id: 'DROPBOX_APP_SECRET', value: e.target.value, category: 'STORAGE', isSecret: true });
                                                setSettings(newSettings);
                                            }}
                                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                        />
                                        <button
                                            onClick={() => handleSaveSetting('DROPBOX_APP_SECRET', getSettingValue('DROPBOX_APP_SECRET'), 'STORAGE', true)}
                                            disabled={saving === 'DROPBOX_APP_SECRET'}
                                            className="p-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl font-bold text-xs"
                                        >
                                            <Save size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <p className="text-[10px] text-slate-400 italic">
                                * Priečinok na Dropboxe musí byť: <b>/TEMPLATES</b>. Používajte Refresh Token pre trvalú funkčnosť.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: LOCAL AGENT */}
            {activeTab === 'agent' && (
                <div className="grid grid-cols-5 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="col-span-3 space-y-8">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                            <h3 className="text-xl font-black text-slate-900 mb-6">Konektivita</h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Agent Access Token</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={getSettingValue('AGENT_ACCESS_TOKEN') || "generujem..."}
                                            className="flex-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono text-slate-500"
                                        />
                                        <button
                                            onClick={() => {
                                                const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                                                handleSaveSetting('AGENT_ACCESS_TOKEN', token, 'AGENT', false);
                                            }}
                                            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100"
                                        >
                                            Regenerovať
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2">
                                        Tento token musí byť nastavený v súbore .env na Mirkine Macu v tlačiarni.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                            <h3 className="text-xl font-black text-slate-900 mb-6">Lokálne cesty (Local Paths)</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Templates Root Path</label>
                                    <input
                                        type="text"
                                        value={getSettingValue('LOCAL_TEMPLATES_PATH')}
                                        onChange={(e) => {
                                            const newSettings = [...settings];
                                            const idx = newSettings.findIndex(s => s.id === 'LOCAL_TEMPLATES_PATH');
                                            if (idx !== -1) newSettings[idx].value = e.target.value;
                                            else newSettings.push({ id: 'LOCAL_TEMPLATES_PATH', value: e.target.value, category: 'AGENT', isSecret: false });
                                            setSettings(newSettings);
                                        }}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                        placeholder="/Users/mirka/Dropbox/Templates"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Output Root Path</label>
                                    <input
                                        type="text"
                                        value={getSettingValue('LOCAL_OUTPUT_PATH')}
                                        onChange={(e) => {
                                            const newSettings = [...settings];
                                            const idx = newSettings.findIndex(s => s.id === 'LOCAL_OUTPUT_PATH');
                                            if (idx !== -1) newSettings[idx].value = e.target.value;
                                            else newSettings.push({ id: 'LOCAL_OUTPUT_PATH', value: e.target.value, category: 'AGENT', isSecret: false });
                                            setSettings(newSettings);
                                        }}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                        placeholder="/Users/mirka/Dropbox/Orders_To_Print"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        handleSaveSetting('LOCAL_TEMPLATES_PATH', getSettingValue('LOCAL_TEMPLATES_PATH'), 'AGENT', false);
                                        handleSaveSetting('LOCAL_OUTPUT_PATH', getSettingValue('LOCAL_OUTPUT_PATH'), 'AGENT', false);
                                    }}
                                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800"
                                >
                                    Uložiť cesty agenta
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-2">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 sticky top-8">
                            <h3 className="text-xl font-black text-slate-900 mb-4">Agent Status</h3>
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col items-center justify-center text-center space-y-3">
                                <div className="h-16 w-16 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                                    <div className="h-4 w-4 rounded-full bg-green-500 animate-pulse" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900">Agent Online</p>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Mac v Kancelárii</p>
                                </div>
                                <div className="w-full pt-4 space-y-2">
                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                        <span className="text-slate-400 uppercase">Posledný ping:</span>
                                        <span className="text-slate-900">Práve teraz</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                        <span className="text-slate-400 uppercase">Verzia:</span>
                                        <span className="text-slate-900">v3.5.0-cloud</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: DATABASE */}
            {activeTab === 'db' && (
                <div className="grid grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                            <RotateCw size={24} className="text-blue-400" />
                            AI Learning Stats
                        </h3>
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Počet záznamov v ai_learning</p>
                            <p className="text-3xl font-black text-slate-900">{stats?.patternCount || 0}</p>
                            <p className="text-[11px] text-slate-500 mt-2">Toľko opráv sa AI už naučila a používa ich pri parsovaní nových objednávok.</p>
                        </div>
                        <button
                            onClick={handleExportDataset}
                            className="w-full py-4 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                        >
                            Exportovať učiaci dataset (.json)
                        </button>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                            <FileText size={24} className="text-green-500" />
                            Katalóg Šablón (CSV)
                        </h3>
                        <p className="text-xs text-slate-500 mb-4 font-medium leading-relaxed">
                            Nahrajte CSV export produktov. Systém automaticky spáruje produkty so šablónami podľa názvu a označí ich ako OVERENÉ.
                        </p>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleImportCatalog}
                                disabled={uploading}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className={`w-full py-6 border-2 border-dashed ${uploading ? 'border-slate-300 bg-slate-50' : 'border-green-200 bg-green-50/50 text-green-700 hover:bg-green-100'} rounded-xl text-center font-bold text-sm transition-all flex flex-col items-center justify-center gap-3`}>
                                {uploading ? (
                                    <>
                                        <Loader2 className="animate-spin text-slate-400" size={24} />
                                        <span className="text-slate-500">Analyzujem CSV a párujem...</span>
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud size={24} />
                                        <span>Nahrať CSV Katalóg</span>
                                        <span className="text-[10px] uppercase tracking-widest opacity-70">Kliknite alebo potiahnite súbor sem</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                        <h3 className="text-xl font-black text-slate-900 mb-6">System Health</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-xs font-bold text-slate-500">Prisma Client Status</span>
                                <span className="flex items-center gap-1.5 text-xs font-black text-green-600">
                                    <CheckCircle2 size={14} /> Connected
                                </span>
                            </div>
                            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-xs font-bold text-slate-500">PostgreSQL (Supabase)</span>
                                <span className="flex items-center gap-1.5 text-xs font-black text-green-600">
                                    <CheckCircle2 size={14} /> Healthy
                                </span>
                            </div>
                        </div>
                        <div className="mt-8 grid grid-cols-2 gap-4">
                            <button className="py-4 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100">
                                Re-indexovať šablóny
                            </button>
                            <button className="py-4 bg-red-50 border border-red-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-100">
                                Vymazať cache
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
