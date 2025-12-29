import firebase_admin
from firebase_admin import credentials
from firebase_admin import db
import paho.mqtt.client as mqtt
import json
import time

# --- 1. SETUP FIREBASE ---
# Pastikan nama file JSON sesuai dengan yang ada di folder laptopmu
JSON_KEY_FILE = "komposproject-dfe5e-firebase-adminsdk-fbsvc-07b42ceab7.json"

try:
    cred = credentials.Certificate(JSON_KEY_FILE)
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://komposproject-dfe5e-default-rtdb.asia-southeast1.firebasedatabase.app/'
    })
except FileNotFoundError:
    print(f"\n[CRITICAL ERROR] File kunci Firebase tidak ditemukan!")
    print(f"Mohon pastikan file '{JSON_KEY_FILE}' ada di folder ini.")
    print("Download file dari Firebase Console -> Project Settings -> Service Accounts.\n")
    exit(1)

# Reference untuk History (Grafik)
ref_history = db.reference('sensor_logs')
# Reference untuk Status Terkini (Angka Realtime)
ref_current = db.reference('sensor_now')

# --- 2. KONFIGURASI MQTT ---
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
MQTT_TOPIC = "talha/sensor"

# --- 3. VARIABEL UNTUK INTERVAL & BUFFER ---
# Menyimpan waktu awal jendela pengumpulan data (dalam detik, time.time())
last_send_time = None
# Buffer untuk menyimpan data mentah selama 10 menit
data_buffer = []
# Interval 10 menit (600 detik)
SEND_INTERVAL = 600

# --- 4. FUNGSI CALLBACK MQTT ---

def on_connect(client, userdata, flags, rc, properties=None):
    print(f"Terhubung ke MQTT Broker! Code: {rc}")
    client.subscribe(MQTT_TOPIC)
    print(f"Mendengarkan topic: {MQTT_TOPIC}...")

def on_message(client, userdata, msg):
    global last_send_time, data_buffer
    
    try:
        # 1. Terima payload
        payload = msg.payload.decode("utf-8")
        print(f"\n[MQTT] Terima Data: {payload}")
        
        # 2. Parsing JSON
        data_json = json.loads(payload)
        
        # 3. Tambahkan data ke buffer
        current_time = time.time()
        if last_send_time is None:
            # Mulai jendela pertama saat data pertama masuk
            last_send_time = current_time
        
        data_buffer.append(data_json)
        time_since_window_start = current_time - last_send_time
        
        # 4. Kalau belum 10 menit, hanya kumpulkan data saja
        if time_since_window_start < SEND_INTERVAL:
            menit = time_since_window_start / 60.0
            print(f"⏳ Mengumpulkan data, sudah {menit:.1f} menit... Belum kirim ke Firebase.")
            return
        
        # 5. Sudah 10 menit -> hitung rata-rata dari buffer
        if not data_buffer:
            # Harusnya tidak terjadi, tapi untuk jaga-jaga
            print("⚠️ Buffer kosong saat akan dikirim, tidak ada data untuk dirata-rata.")
            last_send_time = current_time
            return
        
        num_samples = len(data_buffer)
        avg_data = {}
        
        # Kumpulkan jumlah untuk setiap field numerik
        for entry in data_buffer:
            for key, value in entry.items():
                if isinstance(value, (int, float)):
                    if key not in avg_data:
                        avg_data[key] = 0.0
                    avg_data[key] += float(value)
        
        # Bagi dengan jumlah sampel supaya jadi rata-rata
        for key in list(avg_data.keys()):
            avg_data[key] = avg_data[key] / num_samples
        
        # Tambahkan informasi tambahan
        avg_data['timestamp'] = int(time.time() * 1000)  # milidetik
        avg_data['samples'] = num_samples  # berapa banyak data dalam 10 menit
        
        # 6. KIRIM KE FIREBASE (rata-rata 10 menit)
        ref_history.push(avg_data)
        ref_current.set(avg_data)
        
        print(f"✅ [Firebase] Kirim RATA-RATA {num_samples} sampel untuk 10 menit terakhir!")
        
        # 7. Reset jendela 10 menit berikutnya
        data_buffer = []
        last_send_time = current_time
        
    except Exception as e:
        print(f"❌ Error memproses data: {e}")

# --- 5. PROGRAM UTAMA ---
if __name__ == "__main__":
    print("Menjalankan Bridge MQTT -> Firebase...")
    
    # Setup Client (Kompatibel dengan Paho MQTT v2.x)
    # CallbackAPIVersion.VERSION2 wajib untuk library terbaru
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    except:
        # Fallback jika masih pakai library versi lama
        client = mqtt.Client()
        
    client.on_connect = on_connect
    client.on_message = on_message
    
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\nProgram dihentikan.")