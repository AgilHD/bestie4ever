import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { LayoutDashboard } from 'lucide-react';

export default function DashboardHeader({ lastUpdate, isDark }) {
    return (
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
            >
                <h2 className={clsx(
                    "text-3xl font-bold tracking-tight mb-2 flex items-center gap-3",
                    isDark ? "text-white" : "text-slate-900"
                )}>
                    <LayoutDashboard className="w-8 h-8 text-emerald-500" />
                    Dashboard Monitoring
                </h2>
                <div className="flex items-center gap-2 text-sm">
                    <span className={clsx("w-2 h-2 rounded-full", isDark ? "bg-emerald-500" : "bg-emerald-600")}></span>
                    <p className={clsx(isDark ? "text-slate-400" : "text-slate-500")}>
                        Last synched: <span className="font-mono font-medium">{lastUpdate || 'Scanning...'}</span>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
