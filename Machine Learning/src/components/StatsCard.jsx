import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function StatsCard({ title, value, unit, icon: Icon, color, isDark, delay = 0, subValue }) {
    // Define color schemes
    const colorStyles = {
        red: isDark ? "from-red-900/20 to-red-900/5 text-red-400 border-red-900/30" : "from-red-50 to-white text-red-600 border-red-100",
        blue: isDark ? "from-blue-900/20 to-blue-900/5 text-blue-400 border-blue-900/30" : "from-blue-50 to-white text-blue-600 border-blue-100",
        green: isDark ? "from-emerald-900/20 to-emerald-900/5 text-emerald-400 border-emerald-900/30" : "from-emerald-50 to-white text-emerald-600 border-emerald-100",
        purple: isDark ? "from-purple-900/20 to-purple-900/5 text-purple-400 border-purple-900/30" : "from-purple-50 to-white text-purple-600 border-purple-100",
        amber: isDark ? "from-amber-900/20 to-amber-900/5 text-amber-400 border-amber-900/30" : "from-amber-50 to-white text-amber-600 border-amber-100",
        slate: isDark ? "from-slate-800 to-slate-900 text-slate-400 border-slate-700" : "from-slate-50 to-white text-slate-600 border-slate-200",
    };

    const selectedColor = colorStyles[color] || colorStyles.slate;
    const iconColor = isDark ? "text-slate-300" : "text-slate-500";

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay * 0.1, duration: 0.5 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className={clsx(
                "relative overflow-hidden rounded-2xl p-5 border shadow-sm transition-all",
                "bg-gradient-to-br",
                selectedColor,
                isDark ? "hover:shadow-lg hover:shadow-black/20" : "hover:shadow-lg hover:shadow-slate-200/50"
            )}
        >
            <div className="flex justify-between items-start mb-3">
                <span className={clsx("font-medium text-sm tracking-wide opacity-80", isDark ? "text-slate-300" : "text-slate-600")}>
                    {title}
                </span>
                <div className={clsx("p-2 rounded-lg bg-black/5 dark:bg-white/5", iconColor)}>
                    <Icon size={18} />
                </div>
            </div>

            <div className="flex items-baseline gap-1">
                <span className={clsx(
                    "text-4xl font-bold tracking-tight",
                    isDark ? "text-slate-100" : "text-slate-800"
                )}>
                    {value}
                </span>
                {unit && <span className={clsx("text-sm font-medium opacity-60", isDark ? "text-slate-400" : "text-slate-500")}>{unit}</span>}
            </div>

            {subValue && (
                <div className={clsx("mt-2 text-xs font-medium px-2 py-1 rounded inline-block", isDark ? "bg-white/10 text-slate-300" : "bg-black/5 text-slate-600")}>
                    {subValue}
                </div>
            )}
        </motion.div>
    );
}
