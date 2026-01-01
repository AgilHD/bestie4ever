import React from 'react';
import { History, Clock, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

export default function HistoryTable({ data, isDark }) {
    const isMature = (status) => status && status.toLowerCase().includes("matang") && !status.toLowerCase().includes("belum");

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className={clsx(
                "rounded-3xl border shadow-sm overflow-hidden",
                isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}
        >
            <div className={clsx(
                "p-6 border-b flex items-center justify-between",
                isDark ? "border-slate-800" : "border-slate-100"
            )}>
                <div className="flex items-center gap-3">
                    <div className={clsx("p-2 rounded-lg", isDark ? "bg-slate-800" : "bg-slate-100")}>
                        <History className={clsx("w-5 h-5", isDark ? "text-slate-400" : "text-slate-500")} />
                    </div>
                    <h3 className={clsx("font-bold text-lg", isDark ? "text-slate-100" : "text-slate-800")}>Recent History</h3>
                </div>
                <span className={clsx("text-xs font-medium px-3 py-1 rounded-full", isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500")}>Recent 5 Entries</span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className={clsx(
                        "uppercase font-semibold tracking-wider text-xs",
                        isDark ? "bg-slate-950/50 text-slate-500" : "bg-slate-50/50 text-slate-400"
                    )}>
                        <tr>
                            <th className="px-6 py-4">Time</th>
                            <th className="px-6 py-4">Temp</th>
                            <th className="px-6 py-4">Moisture</th>
                            <th className="px-6 py-4">pH</th>
                            <th className="px-6 py-4">Ammonia</th>
                            <th className="px-6 py-4">Score</th>
                            <th className="px-6 py-4">Status</th>
                        </tr>
                    </thead>
                    <tbody className={clsx("divide-y", isDark ? "divide-slate-800" : "divide-slate-100")}>
                        {data.slice(0, 5).map((log, index) => (
                            <tr
                                key={log.id}
                                className={clsx(
                                    "transition-colors",
                                    isDark ? "hover:bg-slate-800/50 text-slate-300" : "hover:bg-slate-50 text-slate-600"
                                )}
                            >
                                <td className="px-6 py-4 font-mono opacity-70">{log.timestamp}</td>
                                <td className="px-6 py-4 font-medium">{log.suhu}°C</td>
                                <td className="px-6 py-4">{log.moisture}%</td>
                                <td className="px-6 py-4">
                                    <span className={clsx(
                                        "px-2 py-1 rounded text-xs font-bold",
                                        log.ph < 6 ? (isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700') :
                                            log.ph > 8 ? (isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700') :
                                                (isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700')
                                    )}>
                                        {parseFloat(log.ph).toFixed(1)}
                                    </span>
                                </td>
                                <td className={clsx("px-6 py-4 font-medium", isDark ? "text-purple-400" : "text-purple-600")}>
                                    {log.ammonia} ppm
                                </td>
                                <td className={clsx("px-6 py-4 font-bold", isDark ? "text-amber-400" : "text-amber-600")}>
                                    {log.score}
                                </td>
                                <td className="px-6 py-4">
                                    <div className={clsx(
                                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
                                        isMature(log.maturity)
                                            ? (isDark ? 'bg-emerald-900/20 border-emerald-900/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
                                            : (isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600')
                                    )}>
                                        {isMature(log.maturity) ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                        {log.maturity}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr>
                                <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                                    Waiting for synchronized data...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
}
