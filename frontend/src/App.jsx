import React, { useEffect, useState } from 'react';
import { database } from './firebase_config';
import { ref, onValue } from 'firebase/database';
import { Activity, Leaf, Droplets, Thermometer, FlaskConical, AlertTriangle, ExternalLink, History } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const INITIAL_DATA = {
  sensors: { humidity: 0, temperature: 0, ph: 0 },
  prediction: { status: 'Menghitung...', confidence: 0, narrative: 'Mengambil data...' }
};

function App() {
  const [data, setData] = useState(INITIAL_DATA);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const sensorsRef = ref(database, '/');
    const unsubscribe = onValue(sensorsRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        setData(val);
        if (val.sensors) {
          // Update History
          setHistory(prev => {
            const newHistory = [...prev, { time: new Date().toLocaleTimeString(), ...val.sensors }];
            return newHistory.slice(-30); // Keep last 30 points
          });

          // Check for Alerts
          const newAlerts = [];
          if (val.sensors.ph < 5 || val.sensors.ph > 8) newAlerts.push("pH tidak stabil (Asam/Basa berlebih)");
          if (val.sensors.humidity < 40) newAlerts.push("Kelembapan rendah, perlu penyiraman");
          if (val.sensors.temperature > 65) newAlerts.push("Suhu terlalu tinggi, bahaya kebakaran");
          if (val.sensors.temperature < 25) newAlerts.push("Suhu terlalu rendah, fermentasi lambat");
          setAlerts(newAlerts);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="container">
      <header className="glass-panel" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', marginBottom: '1.5rem', height: 'auto' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem' }}>
          <Leaf className="text-success" size={28} />
          <div>
            Monitoring <span style={{ fontWeight: 300, opacity: 0.8 }}>Kematangan Limbah</span>
          </div>
        </h1>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Status Koneksi</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <span className="animate-pulse" style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%' }}></span>
              <span style={{ fontSize: '0.9rem' }}>Realtime</span>
            </div>
          </div>
        </div>
      </header>

      {/* Alerts Banner */}
      {/* Alerts Toast Overlay */}
      <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '400px' }}>
        <AnimatePresence>
          {alerts.length > 0 && (
            alerts.map((alert, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.9 }}
                layout
                style={{
                  background: 'rgba(30, 41, 59, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid var(--color-danger)',
                  borderLeft: '4px solid var(--color-danger)',
                  color: '#fca5a5',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)'
                }}
              >
                <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '6px', borderRadius: '50%', flexShrink: 0 }}>
                  <AlertTriangle size={20} className="text-danger" />
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.9rem', color: '#fff', marginBottom: '2px' }}>Peringatan Sistem</strong>
                  <span style={{ fontSize: '0.85rem' }}>{alert}</span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <div className="dashboard-grid">
        {/* Sidebar: Prediction & Expert System */}
        <aside className="sidebar glass-panel" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Main Sidebar Content - centered and scrollable if screens are small */}
          <div style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
              <Activity size={20} className="text-info" /> Status Kematangan
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem', width: '100%' }}>
              <StatusIndicator status={data.prediction?.status} percentage={data.prediction?.confidence} />

              <div style={{ margin: '0' }}>
                <p style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0' }}>
                  {data.prediction?.confidence}%
                </p>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Probabilitas Kematangan</p>
              </div>

              {/* Narrative Box - Fixed Height, cleaner look */}
              <div className="narrative-box" style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '1rem',
                borderRadius: '0.75rem',
                fontSize: '0.9rem',
                lineHeight: '1.5',
                textAlign: 'left',
                width: '100%',
                height: '140px', /* Fixed height as requested */
                display: 'flex',
                flexDirection: 'column'
              }}>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>
                  Analisis AI
                </p>
                <p style={{ overflowY: 'auto', flex: 1, scrollbarWidth: 'thin', paddingRight: '5px' }}>
                  {data.prediction?.narrative}
                </p>
              </div>
            </div>
          </div>

          {/* Fixed Footer for Expert System Link */}
          <div style={{
            marginTop: 'auto',
            padding: '1.5rem 2rem',
            borderTop: '1px solid var(--glass-border)',
            background: 'rgba(15, 23, 42, 0.4)', /* Slightly darker for contrast */
            flexShrink: 0
          }}>
            <a
              href="https://example.com/expert-system"
              target="_blank"
              rel="noreferrer"
              className="expert-btn"
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '1rem',
                background: 'linear-gradient(45deg, var(--color-info), var(--color-success))',
                borderRadius: '0.75rem',
                color: 'white',
                textDecoration: 'none',
                fontWeight: '600',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                transition: 'transform 0.2s'
              }}
            >
              <ExternalLink size={18} /> Sistem Pakar Pupuk
            </a>
          </div>
        </aside>

        {/* Main Content */}
        <div className="main-content">
          {/* Top Row: Sensors */}
          <div className="sensor-row">
            <SensorCard
              icon={<FlaskConical size={24} className="text-success" />}
              label="Kadar pH"
              value={data.sensors?.ph}
              unit="pH"
              color="var(--color-success)"
            />
            <SensorCard
              icon={<Droplets size={24} className="text-info" />}
              label="Kelembapan"
              value={data.sensors?.humidity}
              unit="%"
              color="var(--color-info)"
            />
            <SensorCard
              icon={<Thermometer size={24} className="text-warning" />}
              label="Suhu"
              value={data.sensors?.temperature}
              unit="°C"
              color="var(--color-warning)"
            />
          </div>

          {/* Bottom Row: Charts */}
          <div className="chart-section glass-panel" style={{ padding: '1.5rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={20} /> Riwayat Data Sensor (Real-time)
              </h2>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                <span style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}>● Humidity</span>
                <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>● Temp</span>
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>● pH</span>
              </div>
            </div>

            <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorPh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ fontSize: '0.85rem' }}
                    labelStyle={{ marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.25rem' }}
                  />
                  <Area type="monotone" dataKey="humidity" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPh)" name="Kelembapan" activeDot={{ r: 6 }} />
                  <Area type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorTemp)" name="Suhu" />
                  <Area type="monotone" dataKey="ph" stroke="#10b981" strokeWidth={2} fill="transparent" name="pH" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SensorCard = ({ icon, label, value, unit, color }) => (
  <div className="glass-panel" style={{ padding: '1.5rem', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
    <div>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{label}</p>
      <div style={{ fontSize: '2rem', fontWeight: '700', color: 'white' }}>
        {value} <span style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--color-text-secondary)' }}>{unit}</span>
      </div>
    </div>
    <div style={{
      width: '48px', height: '48px',
      borderRadius: '12px',
      background: `rgba(255,255,255,0.05)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: color
    }}>
      {icon}
    </div>
  </div>
);

const StatusIndicator = ({ status }) => {
  let color = '#94a3b8';
  let shadowColor = 'rgba(148, 163, 184, 0.5)';

  if (status === 'Matang') { color = '#10b981'; shadowColor = 'rgba(16, 185, 129, 0.5)'; }
  if (status === 'Transisi') { color = '#f59e0b'; shadowColor = 'rgba(245, 158, 11, 0.5)'; }
  if (status === 'Belum Matang') { color = '#ef4444'; shadowColor = 'rgba(239, 68, 68, 0.5)'; }

  return (
    <div style={{ position: 'relative', width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer Glow */}
      <motion.div
        animate={{ boxShadow: `0 0 30px ${shadowColor}` }}
        transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `2px solid ${color}`, opacity: 0.3
        }}
      />
      {/* Percentage Circle (Simulated SVG) */}
      <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="transparent" />
        <motion.circle
          cx="50" cy="50" r="45"
          stroke={color}
          strokeWidth="6"
          fill="transparent"
          strokeDasharray="283"
          strokeDashoffset="0"
          initial={{ strokeDashoffset: 283 }}
          animate={{ strokeDashoffset: 0 }} /* Just full circle for status border, or map to confidence if desired */
          transition={{ duration: 1.5 }}
        />
      </svg>

      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: color }}>{status}</p>
      </div>
    </div>
  );
};

export default App;
