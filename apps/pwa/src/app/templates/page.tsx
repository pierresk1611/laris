"use client";

import AppHeader from "@/components/AppHeader";
import {
    Layers,
    Search,
    Plus,
    MoreHorizontal,
    FolderOpen
} from "lucide-react";

const mockTemplates = [
    { key: "JSO 15", name: "Jubilejná Svadobná 15", mappedPaths: 12, status: "ACTIVE" },
    { key: "VSO 02", name: "Vianočná Súprava 02", mappedPaths: 8, status: "ACTIVE" },
    { key: "JSO 22", name: "Jubilejná Svadobná 22", mappedPaths: 0, status: "MISSING_MANIFEST" },
];

export default function TemplatesPage() {
    return (
        <div>
            <AppHeader title="Šablóny" />

            <div className="flex justify-between items-center mb-8">
                <div className="relative w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Hľadať šablónu (napr. JSO)..."
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                    />
                </div>
                <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-xl">
                    <Plus size={18} />
                    <span>Nová Šablóna</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {mockTemplates.map((template) => (
                    <div key={template.key} className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">
                                <Layers className="text-slate-400 group-hover:text-blue-500" size={24} />
                            </div>
                            <button className="p-2 text-slate-400 hover:text-slate-600">
                                <MoreHorizontal size={20} />
                            </button>
                        </div>

                        <h3 className="text-lg font-black text-slate-900 mb-1">{template.key}</h3>
                        <p className="text-sm font-medium text-slate-500 mb-6">{template.name}</p>

                        <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                            <div className="flex items-center gap-2">
                                <FolderOpen size={14} className="text-slate-400" />
                                <span className="text-xs font-bold text-slate-600">{template.mappedPaths} polí namapovaných</span>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${template.status === 'ACTIVE'
                                    ? 'bg-green-100 text-green-600'
                                    : 'bg-red-100 text-red-600'
                                }`}>
                                {template.status === 'ACTIVE' ? 'Aktívna' : 'Bez manifestu'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
