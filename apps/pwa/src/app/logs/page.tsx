"use client";

import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import { History, Clock, CheckCircle2, AlertCircle, Cpu } from "lucide-react";

export default function HistoryPage() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch('/api/agent/jobs/history');
                const data = await res.json();
                if (data.success) {
                    setJobs(data.jobs);
                }
            } catch (e) {
                console.error("Failed to fetch history", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, []);

    return (
        <div className="pb-20">
            <AppHeader title="Logy Agenta" />

            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <Cpu className="text-blue-500" size={20} />
                        <h2 className="text-lg font-bold text-slate-900">História úloh</h2>
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-24 text-center text-slate-400">
                        <Clock className="mx-auto mb-4 animate-spin text-blue-500" size={48} />
                        <p className="font-bold">Načítavam históriu úloh...</p>
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="p-24 text-center text-slate-400">
                        <History size={64} className="mx-auto mb-4 opacity-10" />
                        <h3 className="text-xl font-black text-slate-900">Žiadne záznamy</h3>
                        <p className="text-sm font-medium">Agent zatiaľ nevykonal žiadne úlohy.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/30">
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dátum / Čas</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Typ úlohy</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payload</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stav</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Výsledok</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {jobs.map((job) => (
                                    <tr key={job.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-900">
                                                    {new Date(job.createdAt).toLocaleDateString('sk-SK')}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    {new Date(job.createdAt).toLocaleTimeString('sk-SK')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                                {job.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-[10px] bg-slate-50 p-1.5 rounded-md text-slate-600 font-mono block max-w-[200px] truncate">
                                                {JSON.stringify(job.payload)}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {job.status === 'SUCCESS' ? (
                                                    <CheckCircle2 className="text-green-500" size={14} />
                                                ) : job.status === 'ERROR' ? (
                                                    <AlertCircle className="text-red-500" size={14} />
                                                ) : (
                                                    <Clock className="text-orange-400" size={14} />
                                                )}
                                                <span className={`text-[10px] font-bold uppercase tracking-widest ${job.status === 'SUCCESS' ? 'text-green-600' :
                                                    job.status === 'ERROR' ? 'text-red-600' : 'text-orange-500'
                                                    }`}>
                                                    {job.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="text-[10px] font-medium text-slate-400 truncate max-w-[150px] inline-block">
                                                {job.result ? JSON.stringify(job.result) : '-'}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
