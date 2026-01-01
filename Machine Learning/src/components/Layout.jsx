import React, { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

export default function Layout({ children, toggleTheme, isDark }) {
  return (
    <div className={clsx(
      "min-h-screen transition-colors duration-300 ease-in-out font-sans",
      isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"
    )}>
      {/* Background Elements for Aesthetics */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className={clsx(
          "absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-40 animate-pulse-slow",
          isDark ? "bg-emerald-900/30" : "bg-emerald-200/40"
        )} />
        <div className={clsx(
          "absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-40 animate-pulse-slow delay-1000",
          isDark ? "bg-violet-900/30" : "bg-violet-200/40"
        )} />
      </div>

      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
