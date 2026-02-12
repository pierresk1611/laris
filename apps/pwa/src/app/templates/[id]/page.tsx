"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import {
    Layers,
    ArrowLeft,
    RefreshCw,
    Save,
    FileType,
    Hash,
    Type,
    CheckCircle2,
    AlertCircle
} from "lucide-react";

interface PsdLayer {
    name: string;
    type: 'TEXT' | 'IMAGE' | 'GROUP';
    mappedTo?: string;
}

export default function TemplateDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [isLoadingLayers, setIsLoadingLayers] = useState(false);
    const [layers, setLayers] = useState<PsdLayer[]>([]);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    // Load existing mapping from DB
    useEffect(() => {
        const loadMapping = async () => {
            try {
                const res = await fetch(`/api/templates/mapping?key=${encodeURIComponent(params.id as string)}`);
                const data = await res.json();
                if (data.success && data.mapping) {
                    // Convert mappingData JSON to layers array if needed, 
                    // but for now we just handle it when the agent loads them.
                    // If we have saved mappings, we keep them for when layers are loaded.
                    setLayers(prev => prev.map(l => ({
                        ...l,
                        mappedTo: data.mapping[l.name] || l.mappedTo
                    })));
                }
            } catch (e) {
                console.error("Mapping load failed", e);
            }
        };
        loadMapping();
    }, [params.id]);

    const handleSaveMapping = async () => {
        const mappingData: Record<string, string> = {};
        layers.forEach(l => {
            if (l.mappedTo) mappingData[l.name] = l.mappedTo;
        });

        try {
            const res = await fetch('/api/templates/mapping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: params.id,
                    mappingData
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Mapovanie úspešne uložené!");
            }
        } catch (e) {
            alert("Chyba pri ukladaní.");
        }
    };

    const handleLoadLayers = async () => {
        setIsLoadingLayers(true);
        setStatus('loading');

        try {
            const jobRes = await fetch('/api/agent/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'LOAD_LAYERS',
                    payload: { templateId: params.id }
                })
            });
            const jobData = await jobRes.json();

            // Simulation of agent fulfillment (Peter will implement the real loop)
            setTimeout(() => {
                const mockLayers: PsdLayer[] = [
                    { name: 'NAME_MAIN', type: 'TEXT' },
                    { name: 'DATE_EVENT', type: 'TEXT' },
                    { name: 'LOCATION', type: 'TEXT' },
                    { name: 'BG_IMAGE', type: 'IMAGE' },
                    { name: 'FOOTER_CONTENT', type: 'TEXT' }
                ];
                setLayers(mockLayers);
                setStatus('success');
                setIsLoadingLayers(false);
            }, 3000);

        } catch (error) {
            setStatus('error');
            setIsLoadingLayers(false);
        }
    };

    return (
        <div className="pb-12">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                >
                    <ArrowLeft size={20} />
                </button>
                <AppHeader title={`Detail šablóny: ${params.id}`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Info & Actions */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-4 bg-blue-50 rounded-2xl">
                                <FileType className="text-blue-500" size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900">{params.id}</h3>
                                <p className="text-sm font-medium text-slate-500">PSD Šablóna</p>
                            </div>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-slate-50">
                            <button
                                onClick={handleLoadLayers}
                                disabled={isLoadingLayers}
                                className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-black uppercase tracking-wider transition-all shadow-xl ${isLoadingLayers
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'
                                    }`}
                            >
                                <RefreshCw className={isLoadingLayers ? 'animate-spin' : ''} size={18} />
                                <span>{isLoadingLayers ? 'Načítavam z PS...' : 'Načítať vrstvy z PSD'}</span>
                            </button>

                            <p className="text-[10px] text-center font-bold text-slate-400 uppercase tracking-widest px-4 leading-relaxed">
                                Táto akcia vyžaduje spusteného lokálneho agenta s otvoreným Photoshopom.
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-200">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 mb-6">Dostupné meta-polia</h4>
                        <div className="space-y-3">
                            {['customer_name', 'event_date', 'event_location', 'guest_name', 'table_number'].map(field => (
                                <div key={field} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                                    <span className="text-xs font-bold text-slate-300">{field}</span>
                                    <Type size={14} className="text-blue-400 opacity-50" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Layer Mapping */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                                <Layers className="text-blue-500" size={20} />
                                <span>Mapovanie vrstiev</span>
                            </h2>
                            {layers.length > 0 && (
                                <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    {layers.length} vrstiev nájdených
                                </span>
                            )}
                        </div>

                        <div className="p-0">
                            {status === 'idle' && (
                                <div className="p-12 text-center text-slate-400">
                                    <Layers size={48} className="mx-auto mb-4 opacity-10" />
                                    <p className="font-bold">Zoznam vrstiev je prázdny</p>
                                    <p className="text-sm">Kliknite na "Načítať vrstvy" pre načítanie dát z PSD súboru.</p>
                                </div>
                            )}

                            {status === 'loading' && (
                                <div className="p-12 space-y-4">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="h-16 w-full bg-slate-50 animate-pulse rounded-2xl"></div>
                                    ))}
                                </div>
                            )}

                            {status === 'success' && (
                                <div className="divide-y divide-slate-50">
                                    {layers.map((layer, idx) => (
                                        <div key={idx} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-slate-100 rounded-lg">
                                                    {layer.type === 'TEXT' ? <Type size={16} className="text-slate-400" /> : <Layers size={16} className="text-slate-400" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">{layer.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{layer.type} LAYER</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <select
                                                    className="pl-4 pr-10 py-2 bg-slate-100 border-none rounded-xl text-xs font-bold text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                                                    value={layer.mappedTo || ''}
                                                    onChange={(e) => {
                                                        const newLayers = [...layers];
                                                        newLayers[idx].mappedTo = e.target.value;
                                                        setLayers(newLayers);
                                                    }}
                                                >
                                                    <option value="">Nenamapované</option>
                                                    <option value="customer_name">customer_name</option>
                                                    <option value="event_date">event_date</option>
                                                    <option value="event_location">event_location</option>
                                                </select>
                                                {layer.mappedTo ? (
                                                    <CheckCircle2 className="text-green-500" size={20} />
                                                ) : (
                                                    <AlertCircle className="text-slate-200" size={20} />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {layers.length > 0 && (
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Zmeny sa automaticky ukladajú do manifest.json
                                </p>
                                <button
                                    onClick={handleSaveMapping}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                                >
                                    <Save size={16} />
                                    <span>Uložiť mapovanie</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
