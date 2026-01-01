import mqtt from 'mqtt';
import admin from 'firebase-admin';
import { createRequire } from 'module';

// Membuat fungsi 'require' manual agar bisa load file JSON di environment ES Module
const require = createRequire(import.meta.url);

// 1. KONFIGURASI FIREBASE ADMIN
const serviceAccount = require('./komposproject-dfe5e-firebase-adminsdk-fbsvc-235f1caa0c.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://komposproject-dfe5e-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

// Definisi dua lokasi penyimpanan:
const refLogs = db.ref("sensor_logs"); // Untuk Riwayat (History) - Banyak data
const refNow = db.ref("sensor_now");   // Untuk Realtime (Current) - Cuma 1 data

// 2. KONFIGURASI MQTT
const mqtt_broker = 'mqtt://broker.hivemq.com';
const mqtt_topic = 'talha/sensor';

console.log("Mencoba menghubungkan ke MQTT Broker...");
const client = mqtt.connect(mqtt_broker);

// 3. LOGIKA PROGRAM
client.on('connect', () => {
  console.log(`✅ Terhubung ke Broker: ${mqtt_broker}`);
  client.subscribe(mqtt_topic, (err) => {
    if (!err) {
      console.log(`📡 Subscribe ke topik: ${mqtt_topic}`);
      console.log("⏳ Menunggu data...");
    }
  });
});

client.on('message', (topic, message) => {
  const msgString = message.toString();

  try {
    const data = JSON.parse(msgString);
    
    // --- DEBUGGING DATA UNTUK MODEL ---
    console.log(`\n--- 📥 TERIMA DATA BARU ---`);
    console.log(`Raw JSON : ${msgString}`);
    console.log(`Keys     : [ ${Object.keys(data).join(', ')} ]`);

    // Cek kelengkapan data untuk Model (Suhu, Moisture, pH)
    const required = ['suhu', 'moisture', 'ph'];
    const missing = required.filter(key => data[key] === undefined);

    if (missing.length > 0) {
      console.error(`⚠️  PERINGATAN: Data tidak lengkap untuk model! Hilang: ${missing.join(', ')}`);
    } else {
      console.log(`✅ Struktur data OK (Suhu: ${data.suhu}, Moist: ${data.moisture}, pH: ${data.ph})`);
    }
    // ----------------------------------
    
    // Tambahkan timestamp
    data.timestamp = Date.now();

    // Opsional: Tambahkan dummy 'Day' jika model nanti memerlukannya tapi ESP tidak mengirim
    // data.Day = 1; 

    // --- PROSES SIMPAN KE DUA TEMPAT ---

    // 1. Simpan ke 'sensor_logs' (History) menggunakan push()
    refLogs.push(data);

    // 2. Simpan ke 'sensor_now' (Realtime) menggunakan set()
    refNow.set(data, (error) => {
      if (error) {
        console.error("❌ Gagal update sensor_now:", error);
      } else {
        console.log("💾 Sukses: History bertambah & Data Realtime diperbarui!");
      }
    });

  } catch (e) {
    console.error("⚠️ Error parsing JSON:", e.message);
  }
});