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
    FileText,
    Hash,
    Type,
    CheckCircle2,
    AlertCircle,
    Edit2,
    Check,
    X,
    Sparkles
} from "lucide-react";
import { toast } from "sonner";

interface PsdLayer {
    name: string;
    type: 'TEXT' | 'IMAGE' | 'GROUP';
    content?: string;
    mappedTo?: string;
}

interface VariantInfo {
    type: string;
    path?: string;
    extension?: string;
    mapping?: Record<string, string>;
    imageUrl?: string;
}

const AVAILABLE_META_FIELDS = [
    'NAME_MAIN',
    'DATE_MAIN',
    'TIME_MAIN',
    'PLACE_MAIN',
    'BODY_FULL',
    'QUOTE_TOP',
    'QUOTE_BOTTOM',
    'INVITE_TEXT',
    'FOOTER_TEXT'
];

export default function TemplateDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [isLoadingLayers, setIsLoadingLayers] = useState(false);

    const [variants, setVariants] = useState<VariantInfo[]>([]);
    const [activeVariantType, setActiveVariantType] = useState<string>('MAIN');
    const [layersByVariant, setLayersByVariant] = useState<Record<string, PsdLayer[]>>({});

    // Derived contextual state
    const layers = layersByVariant[activeVariantType] || [];

    // Wrapper to keep existing code functional per-tab
    const setLayers = (val: PsdLayer[] | ((prev: PsdLayer[]) => PsdLayer[])) => {
        setLayersByVariant(prev => {
            const currentLayers = prev[activeVariantType] || [];
            const newLayers = typeof val === 'function' ? val(currentLayers) : val;
            return { ...prev, [activeVariantType]: newLayers };
        });
    };

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [alias, setAlias] = useState<string>('');
    const [isEditingAlias, setIsEditingAlias] = useState(false);
    const [isSavingAlias, setIsSavingAlias] = useState(false);
    const [isAILoading, setIsAILoading] = useState(false);

    const [sku, setSku] = useState<string>('');
    const [isEditingSku, setIsEditingSku] = useState(false);
    const [isSavingSku, setIsSavingSku] = useState(false);

    const [editingPath, setEditingPath] = useState<string>('');
    const [isEditingPath, setIsEditingPath] = useState(false);
    const [isSavingPath, setIsSavingPath] = useState(false);

    const [showHiddenLayers, setShowHiddenLayers] = useState(false);

    // Helper to determine if a layer is likely structural/graphic garbage
    const isGarbageLayer = (layer: PsdLayer) => {
        if (layer.type !== 'TEXT') return true;
        const nameNode = layer.name.toLowerCase();
        if (nameNode.includes('background') || nameNode.includes('bg') || nameNode.includes('pozadie')) return true;
        if (nameNode.includes('rectangle') || nameNode.includes('shape') || nameNode.includes('ellipse')) return true;
        if (nameNode.includes('line') || nameNode.includes('texture') || nameNode.includes('layer ')) return true;
        return false;
    };

    // Filter layers based on current toggle state
    const visibleLayers = layers.filter(l => showHiddenLayers || !isGarbageLayer(l));
    const hiddenLayersCount = layers.length - visibleLayers.length;

    // Load existing mapping from DB
    useEffect(() => {
        const loadMapping = async () => {
            try {
                const res = await fetch(`/api/templates/mapping?key=${encodeURIComponent(params.id as string)}`, { cache: 'no-store' });
                const data = await res.json();
                if (data.success) {
                    // Use displayName (Mirka's custom name) primarily, alias as secondary fallback
                    const initialName = data.displayName || data.alias || '';
                    setAlias(initialName);
                    if (data.sku) setSku(data.sku);

                    let loadedVariants = data.variants || [];
                    if (loadedVariants.length === 0 && data.mapping) {
                        loadedVariants = [{ type: 'MAIN', mapping: data.mapping }];
                    }

                    setVariants(loadedVariants);

                    if (loadedVariants.length > 0) {
                        // Find first variant with a valid path
                        const firstValidVariant = loadedVariants.find((v: any) => v.path) || loadedVariants[0];
                        setActiveVariantType(firstValidVariant.type);

                        const initialLayers: Record<string, PsdLayer[]> = {};
                        loadedVariants.forEach((v: any) => {
                            // First, use extracted layers if they exist
                            if (Array.isArray(v.layers) && v.layers.length > 0) {
                                initialLayers[v.type] = v.layers.map((l: any) => ({
                                    ...l,
                                    mappedTo: v.mapping?.[l.name] || null
                                }));
                            }
                            // Fallback to mapping keys if layers array is missing (legacy)
                            else if (v.mapping && Object.keys(v.mapping).length > 0) {
                                initialLayers[v.type] = Object.keys(v.mapping).map(k => ({
                                    name: k,
                                    type: 'TEXT',
                                    mappedTo: v.mapping[k]
                                }));
                            }
                        });
                        setLayersByVariant(initialLayers);
                        // If we populated layers from DB, treat as success
                        if (Object.keys(initialLayers).length > 0) {
                            setStatus('success');
                        }
                    }
                }
            } catch (e) {
                console.error("Mapping load failed", e);
            }
        };
        loadMapping();
    }, [params.id]);

    // Update editingPath when active variant changes
    useEffect(() => {
        const currentVariant = variants.find(v => v.type === activeVariantType);
        setEditingPath(currentVariant?.path || '');
    }, [activeVariantType, variants]);

    const handleSavePath = async () => {
        setIsSavingPath(true);
        try {
            const res = await fetch('/api/templates/variant-path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId: decodeURIComponent(params.id as string),
                    type: activeVariantType,
                    path: editingPath
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Cesta k súboru bola aktualizovaná");
                // Update local variants state
                setVariants(prev => prev.map(v =>
                    v.type === activeVariantType ? { ...v, path: editingPath } : v
                ));
                setIsEditingPath(false);
                router.refresh();
            } else {
                toast.error(data.error || "Chyba pri ukladaní cesty");
            }
        } catch (e) {
            toast.error("Nepodarilo sa uložiť cestu");
        } finally {
            setIsSavingPath(false);
        }
    };

    const handleSaveAlias = async () => {
        setIsSavingAlias(true);
        try {
            const keyId = decodeURIComponent(params.id as string);
            const res = await fetch('/api/templates/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: keyId, newAlias: alias })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Názov šablóny bol upravený");
                setIsEditingAlias(false);
            } else {
                toast.error(data.error || "Chyba premenovania");
            }
        } catch (e) {
            toast.error("Nepodarilo sa uložiť");
        } finally {
            setIsSavingAlias(false);
        }
    };

    const handleSaveSku = async () => {
        setIsSavingSku(true);
        try {
            const keyId = decodeURIComponent(params.id as string);
            const res = await fetch('/api/templates/sku', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: keyId, newSku: sku })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("SKU šablóny bolo pripravené");
                setIsEditingSku(false);
            } else {
                toast.error(data.error || "Chyba pri ukladaní SKU");
            }
        } catch (e) {
            toast.error("Nepodarilo sa uložiť SKU");
        } finally {
            setIsSavingSku(false);
        }
    };

    const handleAIMapping = async () => {
        setIsAILoading(true);
        const mapPromise = fetch('/api/ai/map-layers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                templateId: decodeURIComponent(params.id as string),
                variantType: activeVariantType,
                layers: layers
            })
        }).then(async res => {
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error);
            return data;
        });

        toast.promise(mapPromise, {
            loading: 'AI analyzuje a mapuje vrstvy...',
            success: (data) => {
                // Apply the mapping visually
                setLayers(prev => prev.map(l => ({
                    ...l,
                    mappedTo: data.mapping[l.name] || ''
                })));
                router.refresh();
                return data.message || "AI Mapovanie úspešné";
            },
            error: 'AI Mapovanie zlyhalo',
            finally: () => setIsAILoading(false)
        });
    };

    const handleSaveMapping = async () => {
        const mappingData: Record<string, string> = {};
        let totalTextLayers = 0;
        layers.forEach(l => {
            if (l.type === 'TEXT') {
                totalTextLayers++;
                if (l.mappedTo && l.mappedTo !== 'IGNORE') {
                    mappingData[l.name] = l.mappedTo;
                }
            }
        });

        // Ensure key is perfectly decoded (e.g. from %20 to space)
        const keyId = decodeURIComponent(params.id as string);

        const savePromise = fetch('/api/templates/mapping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: keyId,
                variantType: activeVariantType,
                mappingData,
                totalTextLayers
            })
        }).then(async res => {
            const data = await res.json();
            if (!res.ok || !data.success) {
                console.error("Save Mapping Error:", data);
                throw new Error(data.details || data.error || "Ukladanie zlyhalo");
            }
            return data;
        });

        toast.promise(savePromise, {
            loading: 'Ukladám mapovanie...',
            success: (data) => {
                // Trigger preview generation silently in background
                fetch('/api/agent/jobs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'GENERATE_PREVIEW',
                        payload: { templateId: keyId }
                    })
                }).catch(console.error);

                // Revalidate client and wait a tiny bit to avoid stale cache from router push
                router.refresh();
                setTimeout(() => {
                    router.push('/templates');
                }, 300);

                return "Mapovanie úspešne uložené!";
            },
            error: (err: any) => `Chyba pri ukladaní: ${err.message}`
        });
    };

    const handleLoadLayers = async () => {
        setIsLoadingLayers(true);
        setStatus('loading');

        try {
            // Find current variant index
            const variantIndex = variants.findIndex(v => v.type === activeVariantType);

            const res = await fetch('/api/templates/extract-layers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId: decodeURIComponent(params.id as string),
                    variantIndex: variantIndex >= 0 ? variantIndex : 0
                })
            });

            const data = await res.json();

            if (data.success) {
                // Update local state with extracted layers
                const newLayers = data.layers.map((l: any) => ({
                    name: l.name,
                    type: l.type,
                    content: l.content,
                    mappedTo: l.mapping || ''
                }));
                setLayers(newLayers);
                setStatus('success');
                toast.success(`Načítaných ${data.textLayerCount} textových vrstiev.`);
            } else {
                throw new Error(data.error || "Chyba pri extrakcii vrstiev.");
            }
        } catch (error: any) {
            toast.error(error.message);
            setStatus('error');
        } finally {
            setIsLoadingLayers(false);
        }
    };

    return (
        <div className="pb-12">
            <div className="flex items-center gap-4 mb-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                >
                    <ArrowLeft size={20} />
                </button>
                <AppHeader title={`Detail šablóny: ${params.id}`} />
            </div>

            {/* VARIANT TAB SWITCHER */}
            {variants.length > 0 && (
                <div className="flex items-center gap-2 mb-8 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm w-fit">
                    {variants.map(v => (
                        <button
                            key={v.type}
                            onClick={() => {
                                setActiveVariantType(v.type);
                            }}
                            className={`px-6 py-2.5 rounded-xl text-sm font-black tracking-widest uppercase transition-all ${activeVariantType === v.type ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            {v.type === 'MAIN' ? '📄 Oznámenie' : v.type === 'INVITE' ? '✉️ Pozvánka' : v.type === 'NAME_TAG' ? '🏷️ Menovka' : v.type}
                        </button>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Info & Actions */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-6">
                        {/* Ikona a Hlavné info */}
                        <div className="flex flex-col items-center text-center space-y-2 w-full">
                            <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 mb-2">
                                <FileText size={40} />
                            </div>

                            {isEditingAlias ? (
                                <div className="flex items-center gap-2 mb-1 w-full px-4">
                                    <input
                                        autoFocus
                                        value={alias}
                                        onChange={e => setAlias(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveAlias()}
                                        className="text-xl font-black text-slate-900 border-b-2 border-blue-500 bg-blue-50/50 outline-none w-full text-center"
                                        placeholder="Nový názov..."
                                        disabled={isSavingAlias}
                                    />
                                    <button onClick={handleSaveAlias} disabled={isSavingAlias} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                        <Check size={18} />
                                    </button>
                                    <button onClick={() => setIsEditingAlias(false)} disabled={isSavingAlias} className="p-1 text-slate-400 hover:bg-slate-50 rounded">
                                        <X size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2 mb-1 group px-4">
                                    <h2 className="text-xl font-bold text-slate-900 break-all leading-tight">
                                        {alias || decodeURIComponent(params.id as string)}
                                    </h2>
                                    <button
                                        onClick={() => {
                                            if (!alias) setAlias(decodeURIComponent(params.id as string));
                                            setIsEditingAlias(true);
                                        }}
                                        className="p-1.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                </div>
                            )}

                            <div className="space-y-1">
                                <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                                    KĽÚČ: {decodeURIComponent(params.id as string)}
                                </p>

                                {isEditingSku ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <input
                                            autoFocus
                                            value={sku}
                                            onChange={e => setSku(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSaveSku()}
                                            className="text-sm font-black text-purple-600 border-b-2 border-purple-500 bg-purple-50/50 outline-none w-32 px-1 text-center"
                                            placeholder="SKU..."
                                            disabled={isSavingSku}
                                        />
                                        <button onClick={handleSaveSku} disabled={isSavingSku} className="text-green-600 hover:bg-green-50 p-1 rounded-lg">
                                            <Check size={14} />
                                        </button>
                                        <button onClick={() => setIsEditingSku(false)} disabled={isSavingSku} className="text-slate-400 hover:bg-slate-50 p-1 rounded-lg">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsEditingSku(true)}
                                        className={`text-[10px] font-bold border px-2 py-0.5 rounded-full transition ${sku ? 'text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100' : 'text-blue-600 border-blue-200 hover:bg-blue-50'
                                            }`}
                                    >
                                        {sku ? `SKU: ${sku}` : '+ PRIDAŤ SKU E-SHOPU'}
                                    </button>
                                )}
                            </div>

                            <div className="pt-4 border-t border-slate-50 w-full px-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Dropbox Cesta ({activeVariantType})</p>
                                {isEditingPath ? (
                                    <div className="flex flex-col gap-2">
                                        <input
                                            autoFocus
                                            value={editingPath}
                                            onChange={e => setEditingPath(e.target.value)}
                                            className="text-[10px] font-mono p-2 bg-slate-50 border border-blue-200 rounded-lg outline-none w-full"
                                            placeholder="/Templates/..."
                                            disabled={isSavingPath}
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleSavePath}
                                                disabled={isSavingPath}
                                                className="flex-1 py-1.5 bg-green-600 text-white text-[10px] font-bold rounded-lg hover:bg-green-700"
                                            >
                                                ULOŽIŤ CESTU
                                            </button>
                                            <button
                                                onClick={() => setIsEditingPath(false)}
                                                disabled={isSavingPath}
                                                className="px-3 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg hover:bg-slate-200"
                                            >
                                                ZRUŠIŤ
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsEditingPath(true)}
                                        className="w-full text-left group"
                                    >
                                        <p className="text-[9px] font-mono text-slate-500 break-all bg-slate-50 p-2 rounded-lg border border-transparent group-hover:border-blue-100 group-hover:bg-blue-50 transition-all">
                                            {editingPath || '⚠️ ŽIADNA CESTA DEFINOVANÁ'}
                                        </p>
                                        <p className="text-[8px] font-bold text-blue-500 mt-1 uppercase text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            Kliknite pre manuálnu úpravu cesty
                                        </p>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Akcia */}
                        <div className="w-full flex flex-col items-center space-y-3">
                            {(() => {
                                const currentVariant = variants.find(v => v.type === activeVariantType);
                                const currentExt = currentVariant?.path?.split('.').pop()?.toLowerCase() || '';
                                const isSourceFormat = ['psd', 'psdt', 'ai'].includes(currentExt);
                                const isImage = ['png', 'jpg', 'jpeg'].includes(currentExt);

                                // Has any source format in the entire template?
                                const hasAnySource = variants.some(v => v.path && ['psd', 'psdt', 'ai'].includes(v.path.toLowerCase().split('.').pop() || ''));

                                return (
                                    <>
                                        <button
                                            onClick={handleLoadLayers}
                                            disabled={isLoadingLayers || !isSourceFormat}
                                            className={`w-full py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition shadow-lg active:scale-[0.98] ${isLoadingLayers || !isSourceFormat
                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                : 'bg-slate-900 text-white hover:bg-slate-800'
                                                }`}
                                        >
                                            <RefreshCw className={isLoadingLayers ? 'animate-spin' : ''} size={20} />
                                            <span>
                                                {isLoadingLayers ? 'NAČÍTAVAM VRSTVY...' :
                                                    (currentExt === 'ai' && !layers.length ? 'ZÍSKAŤ VRSTVY Z AI (Vyžaduje Agenta)' : 'NAČÍTAŤ VRSTVY Z PSD')}
                                            </span>
                                        </button>

                                        {isImage && (
                                            <div className="w-full space-y-2">
                                                <p className="text-[10px] font-bold text-red-500 bg-red-50 p-2.5 rounded-xl border border-red-100 text-center leading-tight">
                                                    Varovanie: Toto je len obrázkový náhľad. Vrstvy je možné načítať a mapovať len zo zdrojového .psd súboru.
                                                </p>
                                                {hasAnySource && (
                                                    <p className="text-[9px] font-medium text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 text-center leading-tight">
                                                        Poznámka: Táto šablóna obsahuje PSD súbor. Pre načítanie vrstiev sa prosím prepnite na variantu so zdrojovým PSD.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {isSourceFormat && (
                                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter text-center leading-tight">
                                                {currentExt === 'ai'
                                                    ? (layers.length > 0 ? "Vrstvy už boli extrahované Agentom. Mapovanie je dostupné offline." : "AI súbory vyžadujú lokálneho Agenta (Illustrator) na prečítanie vrstiev.")
                                                    : "Vykonáva sa bleskovo v cloude bez nutnosti spusteného agenta."}
                                            </p>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-200">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 mb-6">Dostupné meta-polia</h4>
                        <div className="space-y-3">
                            {AVAILABLE_META_FIELDS.map(field => (
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
                            <div className="flex items-center gap-3">
                                {layers.length > 0 && (
                                    <>
                                        <button
                                            onClick={handleAIMapping}
                                            disabled={isAILoading || status !== 'success'}
                                            className="px-3 py-1.5 flex items-center gap-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg text-[11px] font-black uppercase tracking-wider shadow-md transition-all disabled:opacity-50"
                                        >
                                            <Sparkles size={14} className={isAILoading ? "animate-pulse" : ""} />
                                            {isAILoading ? 'Mapujem...' : 'AI Auto-Map'}
                                        </button>
                                        <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                            {layers.length} vrstiev
                                        </span>
                                    </>
                                )}
                            </div>
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
                                    {visibleLayers.map((layer, idx) => {
                                        const originalIdx = layers.findIndex(l => l.name === layer.name);
                                        return (
                                            <div key={idx} className={`p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors ${isGarbageLayer(layer) ? 'opacity-50 grayscale' : ''}`}>
                                                <div className="flex items-center gap-4 min-w-0 max-w-[60%]">
                                                    <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                                                        {layer.type === 'TEXT' ? <Type size={16} className="text-slate-400" /> : <Layers size={16} className="text-slate-400" />}
                                                    </div>
                                                    <div className="min-w-0 overflow-hidden">
                                                        {/* Truncated layer content/name */}
                                                        <p className="text-sm font-black text-slate-900 truncate" title={layer.content || layer.name}>
                                                            {layer.content || layer.name}
                                                        </p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate" title={layer.name}>
                                                            {layer.content ? `LAYER: ${layer.name}` : `${layer.type} LAYER`}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    {layer.type !== 'TEXT' ? (
                                                        <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-400 cursor-not-allowed select-none">
                                                            Ignorované (Grafika)
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <select
                                                                className="pl-4 pr-10 py-2 bg-slate-100 border-none rounded-xl text-xs font-bold text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer w-[160px]"
                                                                value={layer.mappedTo || ''}
                                                                onChange={(e) => {
                                                                    const newLayers = [...layers];
                                                                    newLayers[originalIdx].mappedTo = e.target.value;
                                                                    setLayers(newLayers);
                                                                }}
                                                            >
                                                                <option value="">Nenamapované</option>
                                                                {AVAILABLE_META_FIELDS.map(mf => (
                                                                    <option key={mf} value={mf}>{mf}</option>
                                                                ))}
                                                            </select>
                                                            {layer.mappedTo && layer.mappedTo !== 'IGNORE' ? (
                                                                <div className="w-6 flex justify-center"><CheckCircle2 className="text-green-500 shrink-0" size={20} /></div>
                                                            ) : (
                                                                <div className="w-6 flex justify-center"><AlertCircle className="text-slate-200 shrink-0" size={20} /></div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {/* Toggle Hidden Layers Button */}
                                    {hiddenLayersCount > 0 && (
                                        <div className="p-4 bg-slate-50/50 flex justify-center border-t border-slate-100">
                                            <button
                                                onClick={() => setShowHiddenLayers(!showHiddenLayers)}
                                                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors px-4 py-2 rounded-lg hover:bg-slate-200/50 flex items-center gap-2"
                                            >
                                                {showHiddenLayers ? 'Skryť ignorované vrstvy' : `Zobraziť ${hiddenLayersCount} skrytých vrstiev`}
                                            </button>
                                        </div>
                                    )}
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
