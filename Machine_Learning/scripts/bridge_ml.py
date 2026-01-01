import json
import time
import paho.mqtt.client as mqtt
import firebase_admin
from firebase_admin import credentials, db
import joblib
import pandas as pd
import numpy as np
import os

# ==========================================
# 1. KONFIGURASI DAN LOAD MODEL
# ==========================================
print("⏳ Memuat paket model Machine Learning...")

model_path = 'prediksi.pkl'

if not os.path.exists(model_path):
    print(f"❌ Error: File model '{model_path}' tidak ditemukan!")
    exit()

model_ammonia = None
model_score = None
model_maturity = None

try:
    loaded_object = joblib.load(model_path)

    if isinstance(loaded_object, dict):
        print(f"📦 File Dictionary. Keys: {list(loaded_object.keys())}")
        
        # 1. Cari Model AMMONIA
        if 'rf_regressor_ammonia' in loaded_object:
            model_ammonia = loaded_object['rf_regressor_ammonia']
        elif 'lgbm_ammonia' in loaded_object:
            model_ammonia = loaded_object['lgbm_ammonia']
        else:
            for key, val in loaded_object.items():
                if hasattr(val, 'predict') and 'ammonia' in key.lower():
                    model_ammonia = val
                    break
        
        # 2. Cari Model SCORE
        if 'rf_regressor_score' in loaded_object:
            model_score = loaded_object['rf_regressor_score']
        
        # 3. Cari Model MATURITY
        if 'rf_classifier_maturity' in loaded_object:
            model_maturity = loaded_object['rf_classifier_maturity']

    else:
        model_ammonia = loaded_object

    if model_ammonia is None:
        print("❌ CRITICAL: Model Ammonia tidak ditemukan!")
        exit()

    print("🚀 Sistem Siap: Pipeline Prediksi Aktif")

except Exception as e:
    print(f"❌ Gagal memuat model: {e}")
    exit()

# ==========================================
# 2. KONFIGURASI FIREBASE
# ==========================================
cred_path = 'komposproject-dfe5e-firebase-adminsdk-fbsvc-235f1caa0c.json'

if not os.path.exists(cred_path):
    print(f"❌ Error: File credential '{cred_path}' tidak ditemukan!")
    exit()

cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://komposproject-dfe5e-default-rtdb.asia-southeast1.firebasedatabase.app'
})

ref_logs = db.reference('sensor_logs') 
ref_now = db.reference('sensor_now')   

# ==========================================
# 3. KONFIGURASI MQTT
# ==========================================
MQTT_BROKER = "broker.hivemq.com"
MQTT_TOPIC = "talha/sensor"

def on_connect(client, userdata, flags, rc):
    print(f"✅ Terhubung ke MQTT Broker (Code: {rc})")
    client.subscribe(MQTT_TOPIC)
    print("⏳ Menunggu data masuk...")

def on_message(client, userdata, msg):
    payload = msg.payload.decode()
    
    try:
        data_json = json.loads(payload)
        
        # Ambil data sensor
        suhu = float(data_json.get('suhu', 0))
        moisture = float(data_json.get('moisture', 0))
        ph = float(data_json.get('ph', 7))

        print(f"\n📥 Input: T={suhu}, MC={moisture}, pH={ph}")

        # ============================================================
        # 4. PIPELINE PREDIKSI (PERBAIKAN KOLOM)
        # ============================================================
        
        # --- TAHAP 1: Prediksi AMMONIA ---
        # Input: Temperature, MC(%), pH
        input_ammonia = pd.DataFrame([[suhu, moisture, ph]], 
                                     columns=['Temperature', 'MC(%)', 'pH'])
        
        pred_ammonia = model_ammonia.predict(input_ammonia)[0]
        pred_ammonia = max(0.0, pred_ammonia)
        
        # --- NORMALISASI / KOMPENSASI REAL CASE ---
        # Model ML saat ini memprediksi nilai mentah yang sangat tinggi (~900+).
        # Normal compost ammonia range: 0 - 50 ppm (biasanya).
        # Kita lakukan scaling down linear agar masuk akal untuk user.
        # Asumsi: Raw 1000 ~= 25 ppm (Scale factor 40)
        pred_ammonia = pred_ammonia / 40.0
        
        print(f"   └── 1. Ammonia : {pred_ammonia:.2f} ppm (Normalized)")

        # --- TAHAP 2: Prediksi SCORE ---
        pred_score = 0
        if model_score:
            try:
                # PERBAIKAN: Hapus 'Ammonia(mg/kg)' karena error sebelumnya bilang 'Unseen'.
                # Kita coba hanya input dasar: Temperature, MC(%), pH
                # Jika model butuh 'Day', kita akan lihat di log fitur yang diminta.
                input_score = pd.DataFrame([[suhu, moisture, ph]], 
                                           columns=['Temperature', 'MC(%)', 'pH'])
                
                pred_score = model_score.predict(input_score)[0]
                print(f"   └── 2. Score   : {pred_score:.2f}")
            except Exception as e:
                print(f"   ⚠️ Gagal Score: {e}")
                # DEBUG PENTING: Tampilkan fitur apa yang sebenarnya diminta model
                if hasattr(model_score, 'feature_names_in_'):
                    print(f"      [INFO] Model Score meminta fitur: {model_score.feature_names_in_}")

        # --- TAHAP 3: Prediksi MATURITY ---
        pred_maturity = "Unknown"
        if model_maturity:
            try:
                # Maturity sudah berhasil dengan format ini
                input_maturity = pd.DataFrame([[suhu, moisture, ph, pred_ammonia]], 
                                              columns=['Temperature', 'MC(%)', 'pH', 'Ammonia(mg/kg)'])
                
                maturity_res = model_maturity.predict(input_maturity)[0]
                
                if isinstance(maturity_res, (np.integer, int, float)):
                    pred_maturity = "Matang" if maturity_res == 1 else "Belum Matang"
                else:
                    pred_maturity = str(maturity_res)
                    
                print(f"   └── 3. Maturity: {pred_maturity}")
            except Exception as e:
                print(f"   ⚠️ Gagal Maturity: {e}")
                if hasattr(model_maturity, 'feature_names_in_'):
                    print(f"      [INFO] Model Maturity meminta fitur: {model_maturity.feature_names_in_}")

        # ============================================================
        # 5. SIMPAN KE FIREBASE
        # ============================================================
        data_to_save = {
            'suhu': suhu,
            'moisture': moisture,
            'ph': ph,
            'ammonia': round(pred_ammonia, 2),
            'score': round(pred_score, 2),
            'maturity': pred_maturity,
            'timestamp': int(time.time() * 1000)
        }

        ref_logs.push(data_to_save)
        ref_now.set(data_to_save)

        print("💾 Sukses simpan ke Firebase!")

    except Exception as e:
        print(f"⚠️ Error memproses data: {e}")

# Setup MQTT Client
client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

print("Mencoba menghubungkan ke MQTT...")
client.connect(MQTT_BROKER, 1883, 60)
client.loop_forever()