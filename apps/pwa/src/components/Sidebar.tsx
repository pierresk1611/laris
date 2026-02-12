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
    History
} from "lucide-react";

const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Objednávky", href: "/orders", icon: FileText },
    { name: "Šablóny", href: "/templates", icon: Layers },
    { name: "Print Manager", href: "/print", icon: Printer },
    { name: "História", href: "/history", icon: History },
    { name: "Užívatelia", href: "/users", icon: Users },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 h-screen w-[280px] bg-slate-900 flex flex-col text-slate-400">
            {/* Logo */}
            <div className="p-8 flex items-center gap-3">
                <span className="text-2xl font-black text-white tracking-tighter">⚡ AutoDesign</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                    ? "bg-white/10 text-white shadow-lg"
                                    : "hover:bg-white/5 hover:text-white"
                                }`}
                        >
                            <Icon size={20} className={isActive ? "text-blue-500" : "group-hover:text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]"} />
                            <span className="font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / Settings Pinned */}
            <div className="p-4 border-t border-slate-800">
                <Link
                    href="/settings"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${pathname === "/settings"
                            ? "bg-white/10 text-white shadow-lg"
                            : "hover:bg-white/5 hover:text-white"
                        }`}
                >
                    <Settings size={20} className={pathname === "/settings" ? "text-blue-500" : "group-hover:text-blue-400"} />
                    <span className="font-medium">Nastavenia</span>
                </Link>
            </div>
        </aside>
    );
}
