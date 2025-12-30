import firebase_admin
from firebase_admin import credentials
from firebase_admin import db
import paho.mqtt.client as mqtt
import json
import time

# --- 1. SETUP FIREBASE ---
# Pastikan nama file JSON sesuai dengan yang ada di folder laptopmu
cred = credentials.Certificate("komposproject-dfe5e-firebase-adminsdk-fbsvc-07b42ceab7.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://komposproject-dfe5e-default-rtdb.asia-southeast1.firebasedatabase.app/'
})

# Reference untuk History (Grafik)
ref_history = db.reference('sensor_logs')
# Reference untuk Status Terkini (Angka Realtime)
ref_current = db.reference('sensor_now')

# --- 2. KONFIGURASI MQTT ---
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
MQTT_TOPIC = "talha/sensor"

# --- 3. FUNGSI CALLBACK MQTT ---

def on_connect(client, userdata, flags, rc, properties=None):
    print(f"Terhubung ke MQTT Broker! Code: {rc}")
    client.subscribe(MQTT_TOPIC)
    print(f"Mendengarkan topic: {MQTT_TOPIC}...")

def on_message(client, userdata, msg):
    try:
        # 1. Terima payload
        payload = msg.payload.decode("utf-8")
        print(f"\n[MQTT] Terima Data: {payload}")
        
        # 2. Parsing JSON
        data_json = json.loads(payload)
        
        # 3. Tambahkan timestamp
        # Menggunakan timestamp miliseconds agar lebih presisi
        data_json['timestamp'] = int(time.time() * 1000) 
        
        # 4. KIRIM KE FIREBASE (DUA METODE)
        
        # A. Simpan ke History (Grafik) - Menggunakan .push()
        ref_history.push(data_json)
        
        # B. Simpan ke Current Status (Realtime) - Menggunakan .set()
        # Ini akan menimpa data lama, jadi yang ada disitu selalu data terbaru
        ref_current.set(data_json)
        
        print("✅ [Firebase] Data tersimpan di History & Update Realtime!")
        
    except Exception as e:
        print(f"❌ Error memproses data: {e}")

# --- 4. PROGRAM UTAMA ---
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
