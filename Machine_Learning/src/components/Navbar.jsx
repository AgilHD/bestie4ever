import React from 'react';
import { Activity, Moon, Sun, BrainCircuit } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function Navbar({ isDark, toggleTheme }) {
    return (
        <motion.nav
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={clsx(
                "sticky top-0 z-50 backdrop-blur-md border-b shadow-sm transition-colors",
                isDark ? "bg-slate-900/80 border-slate-800 text-slate-100" : "bg-white/80 border-slate-200 text-slate-800"
            )}
        >
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-600 p-2 rounded-xl shadow-lg shadow-emerald-600/20">
                        <Activity className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-none tracking-tight">Sistem Monitoring</h1>
                        <span className={clsx("text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>Kematangan Kompos</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className={clsx(
                        "hidden md:flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border",
                        isDark ? "bg-emerald-900/30 border-emerald-800 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    )}>
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        System Online
                    </div>

                    <button
                        onClick={toggleTheme}
                        className={clsx(
                            "p-2 rounded-xl border transition-all hover:scale-105 active:scale-95",
                            isDark ? "bg-slate-800 border-slate-700 hover:bg-slate-700 hover:text-emerald-400" : "bg-slate-100 border-slate-200 hover:bg-slate-50 hover:text-emerald-600"
                        )}
                        aria-label="Toggle Theme"
                    >
                        {isDark ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </div>
        </motion.nav>
    );
}
