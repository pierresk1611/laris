"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    FileText,
    Settings,
    Users,
    Layers,
    Printer,
    History,
    LogOut
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";

const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Objednávky", href: "/orders", icon: FileText },
    { name: "Šablóny", href: "/templates", icon: Layers },
    { name: "Print Manager", href: "/print", icon: Printer },
    { name: "História", href: "/history", icon: History },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();

    return (
        <aside className="fixed left-0 top-0 h-screen w-[280px] bg-slate-900 flex flex-col text-slate-400 z-50 shadow-[20px_0_50px_rgba(0,0,0,0.5)] border-r border-slate-800/50">
            {/* Logo */}
            <div className="p-8 flex items-center gap-3">
                <span className="text-3xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">⚡ LARIS</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${isActive
                                ? "bg-blue-600/10 text-blue-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-blue-500/20"
                                : "hover:bg-white/5 hover:text-slate-200 border border-transparent"
                                }`}
                        >
                            <Icon size={20} className={`${isActive ? "text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "group-hover:text-slate-300 transition-colors"}`} />
                            <span className="font-semibold tracking-wide">{item.name}</span>
                        </Link>
                    );
                })}

                {session?.user?.role === 'SUPER_ADMIN' && (
                    <>
                        <div className="pt-6 pb-2 px-4">
                            <p className="text-[10px] font-black tracking-widest uppercase text-slate-600">Admin Nástroje</p>
                        </div>
                        <Link
                            href="/users"
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${pathname === "/users"
                                ? "bg-blue-600/10 text-blue-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-blue-500/20"
                                : "hover:bg-white/5 hover:text-slate-200 border border-transparent"
                                }`}
                        >
                            <Users size={20} className={`${pathname === "/users" ? "text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "group-hover:text-slate-300 transition-colors"}`} />
                            <span className="font-semibold tracking-wide">Užívatelia</span>
                        </Link>
                        <Link
                            href="/settings"
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${pathname === "/settings"
                                ? "bg-blue-600/10 text-blue-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-blue-500/20"
                                : "hover:bg-white/5 hover:text-slate-200 border border-transparent"
                                }`}
                        >
                            <Settings size={20} className={`${pathname === "/settings" ? "text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "group-hover:text-slate-300 transition-colors"}`} />
                            <span className="font-semibold tracking-wide">Nastavenia</span>
                        </Link>
                    </>
                )}
            </nav>

            {/* User Info and Settings Pinned */}
            <div className="p-4 bg-slate-900/80 backdrop-blur-md border-t border-slate-800">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors group">
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-slate-200 truncate pr-2">{session?.user?.name || "Užívateľ"}</p>
                        <p className="text-[10px] text-blue-400 truncate uppercase tracking-widest font-black mt-0.5">{session?.user?.role === 'SUPER_ADMIN' ? 'Admin' : 'Operátor'}</p>
                    </div>
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 p-2 rounded-lg transition-all"
                        title="Odhlásiť sa"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
