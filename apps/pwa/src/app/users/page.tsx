"use client";

import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import { UserPlus, Trash2, Power, PowerOff, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// Define the User interface
interface IUser {
    id: string;
    name: string;
    email: string;
    role: "SUPER_ADMIN" | "OPERATOR";
    isActive: boolean;
    createdAt: string;
}

export default function UsersPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<IUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Form inputs
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<"SUPER_ADMIN" | "OPERATOR">("OPERATOR");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
        } else if (status === "authenticated" && session?.user?.role !== "SUPER_ADMIN") {
            router.replace("/");
        } else if (status === "authenticated" && session?.user?.role === "SUPER_ADMIN") {
            fetchUsers();
        }
    }, [status, session, router]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/users");
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setUsers(data);
        } catch (e) {
            toast.error("Nepodarilo sa načítať užívateľov");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, role }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Chyba pri vytváraní");

            toast.success("Užívateľ úspešne pridaný");
            setIsAddModalOpen(false);

            // premazanie formy
            setName("");
            setEmail("");
            setPassword("");
            setRole("OPERATOR");

            fetchUsers(); // Znova načítať zoznam
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            const res = await fetch(`/api/users/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !currentStatus }),
            });

            if (!res.ok) throw new Error("Nepodarilo sa zmeniť status");

            toast.success(currentStatus ? "Užívateľ deaktivovaný" : "Užívateľ aktivovaný");
            setUsers(users.map(u => u.id === id ? { ...u, isActive: !currentStatus } : u));
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Naozaj chcete natrvalo vymazať tohto užívateľa?")) return;

        try {
            const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Nepodarilo sa zmazať");

            toast.success("Užívateľ zmazaný");
            setUsers(users.filter(u => u.id !== id));
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    if (status === "loading" || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
            </div>
        );
    }

    if (session?.user?.role !== "SUPER_ADMIN") return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <AppHeader title="Správa užívateľov" />

            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">Registrované účty</h2>
                    <p className="text-sm text-slate-500 mt-1">Spravujte prístupy do AutoDesign Cloud System</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-slate-900/20 transition-all active:scale-[0.98]"
                >
                    <UserPlus size={18} />
                    <span>Pridať užívateľa</span>
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest w-[30%]">Užívateľ</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest w-[20%]">Rola</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest w-[20%]">Status</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest w-[15%]">Vytvorený</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest w-[15%] text-right">Akcie</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-inner ${user.role === 'SUPER_ADMIN' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-blue-400 to-cyan-500'}`}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm leading-tight">{user.name}</p>
                                            <p className="text-xs font-medium text-slate-500 mt-0.5">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium">
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${user.role === 'SUPER_ADMIN' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                                        {user.role === 'SUPER_ADMIN' ? <ShieldCheck size={14} /> : <User size={14} />}
                                        {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Operátor'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold border ${user.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                        <div className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-400'}`}></div>
                                        {user.isActive ? 'Aktívny' : 'Deaktivovaný'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-slate-500">
                                    {new Date(user.createdAt).toLocaleDateString('sk-SK')}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleToggleActive(user.id, user.isActive)}
                                            className={`p-2 rounded-lg transition-colors border ${user.isActive ? 'text-amber-600 hover:bg-amber-50 border-amber-100' : 'text-green-600 hover:bg-green-50 border-green-100'}`}
                                            title={user.isActive ? 'Deaktivovať' : 'Aktivovať'}
                                        >
                                            {user.isActive ? <PowerOff size={16} /> : <Power size={16} />}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 border border-red-100 rounded-lg transition-colors"
                                            title="Zmazať účet"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium bg-slate-50/50">
                                    Zatiaľ neboli pridaní žiadni užívatelia (okrem hardcoded admina).
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal na pridanie */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-900">Nový prístup</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <form onSubmit={handleAddUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Meno a priezvisko</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-medium"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email address</label>
                                <input
                                    type="email"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-medium"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Rola v systéme</label>
                                <select
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-medium text-slate-700"
                                    value={role}
                                    onChange={e => setRole(e.target.value as any)}
                                >
                                    <option value="OPERATOR">Operátor (Bežný prístup)</option>
                                    <option value="SUPER_ADMIN">Admin (Plný prístup)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Bezpečné heslo</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-medium"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Zrušiť
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 px-4 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] disabled:opacity-70"
                                >
                                    {isSubmitting ? "Vytváram..." : "Vytvoriť"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
