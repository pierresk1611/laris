"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const res = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        setLoading(false);

        if (res?.error) {
            toast.error(res?.error || "Nesprávne prihlasovacie údaje");
        } else {
            toast.success("Prihlásenie úspešné");
            router.push("/");
            router.refresh();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center -m-8 text-slate-200">
            <div className="bg-white text-slate-900 p-10 rounded-2xl w-full max-w-md border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] relative z-10">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black tracking-tighter mb-2 text-slate-900">⚡ LARIS</h1>
                    <p className="text-sm text-slate-500 font-medium">AutoDesign & Print Hub</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5 flex flex-col items-center">
                    <div className="w-full">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Login Meno alebo Email</label>
                        <input
                            type="text"
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="w-full">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Heslo</label>
                        <input
                            type="password"
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] disabled:opacity-70 mt-6"
                    >
                        {loading ? "Overujem..." : "Prihlásiť sa"}
                    </button>
                </form>
            </div>

            {/* Background elements to match the requested look */}
            <div className="fixed inset-0 bg-slate-900 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-blue-600/10 blur-[100px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[100px]" />
            </div>
        </div>
    );
}
