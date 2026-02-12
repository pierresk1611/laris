"use client";

import AppHeader from "@/components/AppHeader";
import {
    Users,
    UserPlus,
    Shield,
    Mail,
    MoreVertical,
    Trash2,
    Edit2
} from "lucide-react";

const mockUsers = [
    { id: "1", name: "Mirka", email: "mirka@autodesign.sk", role: "SUPER_ADMIN", lastActive: "Pred 2 minútami" },
    { id: "2", name: "Peter", email: "peter@autodesign.sk", role: "ADMIN", lastActive: "Včera o 14:20" },
    { id: "3", name: "Janka", email: "janka@autodesign.sk", role: "OPERATOR", lastActive: "Pred 5 hodinami" },
];

const roleBadges = {
    SUPER_ADMIN: "bg-purple-100 text-purple-600",
    ADMIN: "bg-blue-100 text-blue-600",
    OPERATOR: "bg-green-100 text-green-600",
    VIEWER: "bg-slate-100 text-slate-600",
};

export default function UsersPage() {
    return (
        <div>
            <AppHeader title="Správa užívateľov" />

            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
                    <Users className="text-blue-500" size={20} />
                    <span className="text-sm font-bold text-slate-600">Celkom 3 užívatelia</span>
                </div>
                <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-xl">
                    <UserPlus size={18} />
                    <span>Pridať užívateľa</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50">
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Užívateľ</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rola</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Posledná aktivita</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Akcie</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {mockUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black">
                                            {user.name.charAt(0)}
                                        </div>
                                        <span className="font-bold text-slate-900">{user.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <Mail size={14} />
                                        <span className="text-sm font-medium">{user.email}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${roleBadges[user.role as keyof typeof roleBadges]}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">{user.lastActive}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
