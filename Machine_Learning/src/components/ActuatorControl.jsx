import React, { useState, useEffect } from 'react';
import { Power, Droplets, Wind, Settings2, Cpu } from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, onValue } from 'firebase/database';
import clsx from 'clsx';

// Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD3BiXLDv22IfcJ-w1VQlMj7Sl9JFBQnuo",
    authDomain: "komposproject-dfe5e.firebaseapp.com",
    databaseURL: "https://komposproject-dfe5e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "komposproject-dfe5e",
    storageBucket: "komposproject-dfe5e.firebasestorage.app",
    messagingSenderId: "702334195562",
    appId: "1:702334195562:web:cc7a875f559e4afa05b713",
    measurementId: "G-XYNFFN4VNP"
};

// Initialize Firebase safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);

export default function ActuatorControl({ isDark }) {
    const [pumpOn, setPumpOn] = useState(false);
    const [aeratorOn, setAeratorOn] = useState(false);
    const [isAutoMode, setIsAutoMode] = useState(true); // Default Auto
    const [loading, setLoading] = useState(true);

    // Sync with Firebase on Load
    useEffect(() => {
        const controlRef = ref(db, 'controls');
        const unsubscribe = onValue(controlRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setPumpOn(!!data.pump);
                setAeratorOn(!!data.aerator);
                // logic: if data.auto == 1 -> Auto Mode, else Manual
                setIsAutoMode(data.auto === 1);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Toggle System Mode (Auto/Manual)
    const toggleMode = () => {
        const newMode = !isAutoMode; // true=Auto, false=Manual
        setIsAutoMode(newMode);
        // 1 = Auto (Arduino Logic), 0 = Manual (Remote)
        set(ref(db, 'controls/auto'), newMode ? 1 : 0);
    };

    // Toggle Handlers (Only work in Manual Mode)
    const togglePump = () => {
        if (isAutoMode) return;
        const newState = !pumpOn;
        setPumpOn(newState);
        set(ref(db, 'controls/pump'), newState ? 1 : 0);
    };

    const toggleAerator = () => {
        if (isAutoMode) return;
        const newState = !aeratorOn;
        setAeratorOn(newState);
        set(ref(db, 'controls/aerator'), newState ? 1 : 0);
    };

    return (
        <div className="flex flex-col gap-6 mb-8 mt-4 animate-fade-in-up">

            {/* MODE TOGGLE HEADER */}
            <div className="flex items-center justify-between">
                <h2 className={clsx("text-xl font-bold flex items-center gap-2", isDark ? "text-slate-100" : "text-slate-800")}>
                    <Settings2 className="w-6 h-6 text-emerald-500" />
                    Actuator Control
                </h2>

                <button
                    onClick={toggleMode}
                    className={clsx(
                        "flex items-center gap-3 px-4 py-2 rounded-full border transition-all duration-300 shadow-sm hover:shadow-md active:scale-95",
                        isAutoMode
                            ? (isDark ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700")
                            : (isDark ? "bg-amber-500/10 border-amber-500/50 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-700")
                    )}
                >
                    <div className={clsx(
                        "w-2 h-2 rounded-full animate-pulse",
                        isAutoMode ? "bg-emerald-500" : "bg-amber-500"
                    )}></div>
                    <span className="text-sm font-bold tracking-wide">
                        {isAutoMode ? "AUTOMATIC MODE" : "MANUAL MODE"}
                    </span>
                    {isAutoMode ? <Cpu size={16} /> : <Power size={16} />}
                </button>
            </div>

            {/* ACTUATOR CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* WATER PUMP CARD */}
                <div className={clsx(
                    "relative overflow-hidden rounded-3xl p-6 border shadow-lg transition-all duration-300 group select-none",
                    isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200",
                    !isAutoMode && pumpOn && (isDark ? "shadow-blue-500/20 border-blue-500/30" : "shadow-blue-500/20"),
                    isAutoMode && "opacity-60 grayscale-[0.5]"
                )}>
                    {isAutoMode && <div className="absolute inset-0 z-20 cursor-not-allowed" title="Switch to Manual Mode to control"></div>}

                    {/* Background Glow */}
                    {!isAutoMode && pumpOn && (
                        <div className="absolute inset-0 bg-blue-500/10 blur-xl transition-all duration-500"></div>
                    )}

                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={clsx(
                                "p-3 rounded-2xl transition-all duration-300",
                                !isAutoMode && pumpOn ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" : (isDark ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400")
                            )}>
                                <Droplets size={24} className={clsx(!isAutoMode && pumpOn && "animate-bounce-slow")} />
                            </div>
                            <div>
                                <h3 className={clsx("font-bold text-lg", isDark ? "text-slate-200" : "text-slate-800")}>
                                    Water Pump
                                </h3>
                                <p className="text-xs text-slate-500 font-medium tracking-wide">
                                    {isAutoMode
                                        ? "ARDUINO CONTROLLED"
                                        : (pumpOn ? <span className="text-blue-400">ACTIVE - PUMPING</span> : "OFF - STANDBY")
                                    }
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={togglePump}
                            disabled={loading || isAutoMode}
                            className={clsx(
                                "w-14 h-8 rounded-full p-1 transition-colors duration-300 ease-in-out cursor-pointer",
                                !isAutoMode && pumpOn ? "bg-blue-500" : "bg-slate-600/30",
                                (loading || isAutoMode) && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <div className={clsx(
                                "bg-white w-6 h-6 rounded-full shadow-md transform duration-300 ease-in-out flex items-center justify-center",
                                !isAutoMode && pumpOn ? "translate-x-6" : "translate-x-0"
                            )}>
                                <Power size={12} className={!isAutoMode && pumpOn ? "text-blue-500" : "text-slate-400"} />
                            </div>
                        </button>
                    </div>
                </div>

                {/* AERATOR CARD */}
                <div className={clsx(
                    "relative overflow-hidden rounded-3xl p-6 border shadow-lg transition-all duration-300 group select-none",
                    isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200",
                    !isAutoMode && aeratorOn && (isDark ? "shadow-cyan-500/20 border-cyan-500/30" : "shadow-cyan-500/20"),
                    isAutoMode && "opacity-60 grayscale-[0.5]"
                )}>
                    {isAutoMode && <div className="absolute inset-0 z-20 cursor-not-allowed" title="Switch to Manual Mode to control"></div>}

                    {/* Background Glow */}
                    {!isAutoMode && aeratorOn && (
                        <div className="absolute inset-0 bg-cyan-500/10 blur-xl transition-all duration-500"></div>
                    )}

                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={clsx(
                                "p-3 rounded-2xl transition-all duration-300",
                                !isAutoMode && aeratorOn ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30" : (isDark ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400")
                            )}>
                                <Wind size={24} className={clsx(!isAutoMode && aeratorOn && "animate-spin-slow")} />
                            </div>
                            <div>
                                <h3 className={clsx("font-bold text-lg", isDark ? "text-slate-200" : "text-slate-800")}>
                                    Aerator Fan
                                </h3>
                                <p className="text-xs text-slate-500 font-medium tracking-wide">
                                    {isAutoMode
                                        ? "ARDUINO CONTROLLED"
                                        : (aeratorOn ? <span className="text-cyan-400">ACTIVE - BLOWING</span> : "OFF - STANDBY")
                                    }
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={toggleAerator}
                            disabled={loading || isAutoMode}
                            className={clsx(
                                "w-14 h-8 rounded-full p-1 transition-colors duration-300 ease-in-out cursor-pointer",
                                !isAutoMode && aeratorOn ? "bg-cyan-500" : "bg-slate-600/30",
                                (loading || isAutoMode) && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <div className={clsx(
                                "bg-white w-6 h-6 rounded-full shadow-md transform duration-300 ease-in-out flex items-center justify-center",
                                !isAutoMode && aeratorOn ? "translate-x-6" : "translate-x-0"
                            )}>
                                <Power size={12} className={!isAutoMode && aeratorOn ? "text-cyan-500" : "text-slate-400"} />
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
