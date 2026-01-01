import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function ChartSection({ data, isDark }) {
    if (!data || data.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={clsx(
                "rounded-3xl p-6 border shadow-sm transition-all",
                isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}
        >
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className={clsx("font-bold text-xl flex items-center gap-2", isDark ? "text-slate-100" : "text-slate-800")}>
                        <Activity className="text-emerald-500" size={24} />
                        Realtime Analytics
                    </h3>
                    <p className={clsx("text-sm mt-1", isDark ? "text-slate-400" : "text-slate-500")}>Monitored Environmental Data</p>
                </div>
                <div className={clsx(
                    "text-xs px-3 py-1 rounded-full border",
                    isDark ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-500"
                )}>
                    Live Stream
                </div>
            </div>

            <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={isDark ? "#334155" : "#e2e8f0"}
                            vertical={false}
                        />
                        <XAxis
                            dataKey="timestamp"
                            tick={{ fontSize: 12, fill: isDark ? "#94a3b8" : "#64748b" }}
                            stroke={isDark ? "#475569" : "#cbd5e1"}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                        />

                        {/* Left Y-Axis: Common Metrics */}
                        <YAxis
                            yAxisId="left"
                            tick={{ fontSize: 12, fill: isDark ? "#94a3b8" : "#64748b" }}
                            stroke={isDark ? "#475569" : "#cbd5e1"}
                            tickLine={false}
                            axisLine={false}
                            dx={-10}
                        />

                        {/* Right Y-Axis: Ammonia/High Values */}
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fontSize: 12, fill: "#a855f7" }}
                            stroke="transparent"
                            tickLine={false}
                            dx={10}
                        />

                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDark ? '#1e293b' : 'rgba(255, 255, 255, 0.95)',
                                borderRadius: '16px',
                                border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                color: isDark ? '#e2e8f0' : '#1e293b'
                            }}
                            itemStyle={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
                            cursor={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1 }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />

                        <Line
                            yAxisId="left" type="monotone" dataKey="suhu" name="Temperature (°C)"
                            stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }}
                            strokeOpacity={0.8}
                        />
                        <Line
                            yAxisId="left" type="monotone" dataKey="moisture" name="Moisture (%)"
                            stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }}
                            strokeOpacity={0.8}
                        />
                        <Line
                            yAxisId="left" type="monotone" dataKey="ph" name="pH Level"
                            stroke="#22c55e" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }}
                            strokeOpacity={0.8}
                        />

                        <Line
                            yAxisId="right" type="monotone" dataKey="ammonia" name="Ammonia (ppm)"
                            stroke="#a855f7" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }}
                            strokeDasharray="4 4"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
}
