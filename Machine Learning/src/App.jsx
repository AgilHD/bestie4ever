import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, query, limitToLast, onValue } from 'firebase/database';
import { Thermometer, Droplets, FlaskConical, Wind, Award, Info } from 'lucide-react';
import Layout from './components/Layout';
import Navbar from './components/Navbar';
import DashboardHeader from './components/DashboardHeader';
import StatsCard from './components/StatsCard';
import ChartSection from './components/ChartSection';
import HistoryTable from './components/HistoryTable';
import ExpertSystem from './components/ExpertSystem';
import clsx from 'clsx';

// ==========================================
// 1. CONFIGURATION
// ==========================================
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

// ==========================================
// 2. INITIALIZATION
// ==========================================
let app;
let db;
try {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
} catch (error) {
  console.error("Firebase Init Error:", error);
}

// ==========================================
// 3. MAIN COMPONENT
// ==========================================
export default function App() {
  // State
  const [currentData, setCurrentData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDark, setIsDark] = useState(true); // Default to Dark Mode for "Estetik"

  // Toggle Theme
  const toggleTheme = () => setIsDark(!isDark);

  // Effect: Fetch Data
  useEffect(() => {
    if (!db) {
      setError("Database connection failed. Please check configuration.");
      setLoading(false);
      return;
    }

    const sensorRef = ref(db, 'sensor_logs');
    const recentDataQuery = query(sensorRef, limitToLast(30));

    const unsubscribe = onValue(recentDataQuery, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        const formattedData = Object.keys(data).map(key => {
          const item = data[key];
          return {
            id: key,
            ...item,
            timestamp: item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' }) : "Just now",
            ammonia: item.ammonia !== undefined ? item.ammonia : 0,
            score: item.score !== undefined ? item.score : 0,
            maturity: item.maturity || "Pending..."
          };
        });

        // Sort: Newest first for table, Oldest first for chart
        const sortedByTime = formattedData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // This might need parsing logic if timestamp is string
        // Actually, let's trust the firebase order mostly, but ensure we have arrays
        // Since we did Object.keys, order is not guaranteed.
        // Let's assume input timestamp is ISO string or sortable. 
        // If it's LocaleTimeString it's hard to sort. 
        // Ideally we keep original timestamp for sorting.

        // Re-map to keep original timestamp for sorting
        const rawData = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        rawData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const finalData = rawData.map(item => ({
          ...item,
          timestamp: item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' }) : "Just now",
          ammonia: item.ammonia !== undefined ? item.ammonia : 0,
          score: item.score !== undefined ? item.score : 0,
          maturity: item.maturity || "Pending..."
        }));

        setHistoryData([...finalData].reverse()); // Table: Newest first
        setCurrentData(finalData[finalData.length - 1]); // Latest
        setError(null);
      } else {
        setCurrentData(null);
        setHistoryData([]);
      }
      setLoading(false);
    }, (err) => {
      console.error("DB Error:", err);
      setError("Failed to read data. Permission denied?");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Loading State
  if (loading) {
    return (
      <div className={clsx("min-h-screen flex items-center justify-center", isDark ? "bg-slate-950" : "bg-slate-50")}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-900/30"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 animate-spin"></div>
          </div>
          <p className={clsx("animate-pulse font-medium", isDark ? "text-emerald-500" : "text-emerald-700")}>Connecting to Database...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-600 p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full text-center">
          <Info size={48} className="mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold mb-2">Connection Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <Layout isDark={isDark}>
      <Navbar isDark={isDark} toggleTheme={toggleTheme} />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <DashboardHeader
          lastUpdate={currentData?.timestamp}
          isDark={isDark}
        />

        {/* STATS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard
            title="Temperature"
            value={currentData ? currentData.suhu : 0}
            unit="°C"
            icon={Thermometer}
            color="red"
            isDark={isDark}
            delay={1}
          />
          <StatsCard
            title="Humidity"
            value={currentData ? currentData.moisture : 0}
            unit="%"
            icon={Droplets}
            color="blue"
            isDark={isDark}
            delay={2}
          />
          <StatsCard
            title="Soil pH"
            value={currentData ? parseFloat(currentData.ph).toFixed(1) : 0}
            unit="pH"
            icon={FlaskConical}
            color="green"
            isDark={isDark}
            delay={3}
          />
          <StatsCard
            title="Ammonia Level"
            value={currentData ? currentData.ammonia : 0}
            unit="ppm"
            icon={Wind}
            color="purple"
            isDark={isDark}
            delay={4}
            subValue="AI Prediction"
          />
        </div>

        {/* MAIN ANALYSIS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Chart takes up 2/3 */}
          <div className="lg:col-span-2">
            <ChartSection data={[...historyData].reverse()} isDark={isDark} />
          </div>

          {/* Score/Status Card takes up 1/3 */}
          <div className="flex flex-col gap-4">
            <StatsCard
              title="Maturity Score"
              value={currentData ? currentData.score : 0}
              unit="/ 100"
              icon={Award}
              color="amber"
              isDark={isDark}
              delay={5}
              subValue="AI Evaluation"
            />
            {/* Status Box - Custom Layout since it's unique */}
            <div className={clsx(
              "flex-1 rounded-3xl p-6 border shadow-sm flex flex-col justify-center items-center text-center gap-4 transition-all",
              isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}>
              <div className="relative">
                <div className={clsx(
                  "w-24 h-24 rounded-full flex items-center justify-center text-4xl",
                  currentData && currentData.maturity.toLowerCase().includes("matang") && !currentData.maturity.toLowerCase().includes("belum")
                    ? "bg-emerald-500/20 text-emerald-500"
                    : "bg-slate-500/20 text-slate-500"
                )}>
                  {currentData && currentData.maturity.toLowerCase().includes("matang") && !currentData.maturity.toLowerCase().includes("belum") ? "🌿" : "⏳"}
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-current opacity-30 animate-spin-slow"></div>
              </div>
              <div>
                <h3 className={clsx("text-lg font-medium", isDark ? "text-slate-400" : "text-slate-500")}>Current Status</h3>
                <p className={clsx(
                  "text-2xl font-bold mt-1",
                  currentData && currentData.maturity.toLowerCase().includes("matang") && !currentData.maturity.toLowerCase().includes("belum")
                    ? "text-emerald-500"
                    : "text-slate-500"
                )}>
                  {currentData ? currentData.maturity : "Analyzing..."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* HISTORY TABLE */}
        <HistoryTable data={historyData} isDark={isDark} />

        {/* EXPERT SYSTEM - Embedded */}
        <div className="mt-8 border-t border-dashed border-slate-700/50 pt-8">
          <ExpertSystem isDark={isDark} data={currentData} />
        </div>

      </main>
    </Layout >
  );
}