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
# 0. FUZZY LOGIC ENGINE (Integrated)
# ==========================================
def trapmf(x, params):
    """Trapezoidal Membership Function"""
    a, b, c, d = params
    if x <= a or x >= d: return 0.0
    if a < x < b: return (x - a) / (b - a)
    if c < x < d: return (d - x) / (d - c)
    return 1.0

def trimf(x, params):
    """Triangular Membership Function"""
    a, b, c = params
    if x <= a or x >= c: return 0.0
    if a < x <= b: return (x - a) / (b - a)
    if b < x < c: return (c - x) / (c - b)
    return 0.0

def hitung_membership(suhu, moisture, ph, ammonia, bau_val):
    """Menghitung derajat keanggotaan (Fuzzification)."""
    mu = {}

    # --- SUHU ---
    mu['suhu_dingin'] = trapmf(suhu, [0, 0, 28, 35]) 
    mu['suhu_ideal']  = trimf(suhu, [30, 45, 55])
    mu['suhu_panas']  = trapmf(suhu, [50, 60, 80, 80])

    # --- KELEMBAPAN (MOISTURE) ---
    mu['kelembapan_kering'] = trapmf(moisture, [0, 0, 30, 40])
    mu['kelembapan_sedang'] = trimf(moisture, [40, 46, 52]) 
    mu['kelembapan_basah']  = trapmf(moisture, [50, 60, 100, 100])

    # --- PH ---
    mu['ph_asam']   = trapmf(ph, [0, 0, 5, 6])
    mu['ph_netral'] = trimf(ph, [5.0, 7.0, 9.0])
    mu['ph_basa']   = trapmf(ph, [8, 9, 14, 14])

    # --- VARIABEL SAFETY (AMMONIA & BAU) ---
    mu['ammo_tinggi']   = trapmf(ammonia, [25, 30, 50, 50])
    mu['bau_menyengat'] = trapmf(bau_val, [6, 8, 10, 10])

    return mu

def evaluasi_rules(mu, rules_json):
    """Inference Engine berdasarkan JSON"""
    aggregated = {'buruk': 0.0, 'sedang': 0.0, 'baik': 0.0, 'sangat_baik': 0.0}

    # 1. Safety Override
    bad_factor = max(mu['ammo_tinggi'], mu['bau_menyengat'])
    if bad_factor > 0:
        aggregated['buruk'] = bad_factor

    # 2. Iterasi Rules
    for rule in rules_json:
        c_ph = "ph_" + rule['if']['ph'].lower()
        c_suhu = "suhu_" + rule['if']['suhu'].lower()
        c_mois = "kelembapan_" + rule['if']['kelembapan'].lower()
        
        target = rule['then'].lower().replace(" ", "_")

        val_ph = mu.get(c_ph, 0)
        val_suhu = mu.get(c_suhu, 0)
        val_mois = mu.get(c_mois, 0)
        
        strength = min(val_ph, val_suhu, val_mois)

        if target in aggregated:
            aggregated[target] = max(aggregated[target], strength)

    return aggregated

def defuzzifikasi(aggregated):
    """Menghitung Crisp Output (Score 0-100)"""
    numerator = 0.0
    denominator = 0.0
    
    for x in range(101):
        mu_buruk  = trapmf(x, [0, 0, 30, 50])
        mu_sedang = trimf(x, [40, 60, 80])
        mu_baik   = trimf(x, [70, 85, 95])
        mu_sb     = trapmf(x, [90, 95, 100, 100])
        
        res_buruk  = min(aggregated['buruk'], mu_buruk)
        res_sedang = min(aggregated['sedang'], mu_sedang)
        res_baik   = min(aggregated['baik'], mu_baik)
        res_sb     = min(aggregated['sangat_baik'], mu_sb)
        
        final_mu = max(res_buruk, res_sedang, res_baik, res_sb)
        
        numerator += x * final_mu
        denominator += final_mu

    if denominator == 0: return 0
    return numerator / denominator

# ==========================================
# 1. KONFIGURASI DAN LOAD MODEL
# ==========================================
print("⏳ Memuat paket model & konfigurasi...")

# Load Fuzzy Config
FUZZY_RULES = []
try:
    with open('kompos_config.json', 'r') as f:
        config_data = json.load(f)
        FUZZY_RULES = config_data['rules']
    print("✅ Fuzzy config loaded.")
except Exception as e:
    print(f"⚠️ Warning: Gagal load kompos_config.json ({e}). Fuzzy logic mungkin tidak akurat.")

# Load ML Models
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
        if 'rf_regressor_ammonia' in loaded_object: model_ammonia = loaded_object['rf_regressor_ammonia']
        elif 'lgbm_ammonia' in loaded_object: model_ammonia = loaded_object['lgbm_ammonia']
        
        if 'rf_regressor_score' in loaded_object: model_score = loaded_object['rf_regressor_score']
        if 'rf_classifier_maturity' in loaded_object: model_maturity = loaded_object['rf_classifier_maturity']
    else:
        model_ammonia = loaded_object

    if model_ammonia is None:
        print("❌ CRITICAL: Model Ammonia tidak ditemukan!")
        exit()
    print("🚀 ML Models Siap.")

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
# 3. KONFIGURASI MQTT & LOGIKA
# ==========================================
MQTT_BROKER = "broker.hivemq.com"
MQTT_TOPIC = "talha/sensor"
MQTT_CONTROL_TOPIC = "talha/control"

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
        
        # Default value untuk bau (bisa diambil dari sensor jika ada nanti)
        val_bau = 0 
        txt_bau = "Tidak Bau"

        print(f"\n📥 Input: T={suhu}, MC={moisture}, pH={ph}")

        # ============================================================
        # 4. PIPELINE PREDIKSI ML
        # ============================================================
        
        # --- Prediksi AMMONIA ---
        input_ammonia = pd.DataFrame([[suhu, moisture, ph]], columns=['Temperature', 'MC(%)', 'pH'])
        pred_ammonia = model_ammonia.predict(input_ammonia)[0]
        pred_ammonia = max(0.0, pred_ammonia)
        pred_ammonia = pred_ammonia / 40.0 # Normalisasi
        
        print(f"   └── [ML] Ammonia : {pred_ammonia:.2f} ppm")

        # --- Prediksi MATURITY ---
        pred_maturity = "Unknown"
        if model_maturity:
            try:
                input_maturity = pd.DataFrame([[suhu, moisture, ph, pred_ammonia]], 
                                              columns=['Temperature', 'MC(%)', 'pH', 'Ammonia(mg/kg)'])
                maturity_res = model_maturity.predict(input_maturity)[0]
                pred_maturity = "Matang" if maturity_res == 1 else "Belum Matang"
                print(f"   └── [ML] Maturity: {pred_maturity}")
            except Exception:
                pass

        # ============================================================
        # 5. PIPELINE FUZZY LOGIC (ENGINE)
        # ============================================================
        # Gunakan hasil prediksi ammonia untuk fuzzy
        mu = hitung_membership(suhu, moisture, ph, pred_ammonia, val_bau)
        agg = evaluasi_rules(mu, FUZZY_RULES)
        fuzzy_score = defuzzifikasi(agg)
        
        fuzzy_label = "TIDAK TERDEFINISI"
        if fuzzy_score <= 45: fuzzy_label = "BURUK"
        elif fuzzy_score <= 75: fuzzy_label = "CUKUP / SEDANG"
        elif fuzzy_score <= 92: fuzzy_label = "BAIK"
        else: fuzzy_label = "SANGAT BAIK"

        print(f"   └── [FZ] Score   : {fuzzy_score:.2f} / 100")
        print(f"   └── [FZ] Label   : {fuzzy_label}")

        # ============================================================
        # 6. SIMPAN KE FIREBASE
        # ============================================================
        data_to_save = {
            'suhu': suhu,
            'moisture': moisture,
            'ph': ph,
            'ammonia': round(pred_ammonia, 2),
            
            # Kita simpan dua versi score agar aman
            'ml_score': 0, # Placeholder jika ML score dipakai
            'fuzzy_score': round(fuzzy_score, 2),
            'fuzzy_label': fuzzy_label, 
            
            # Field 'score' utama pakai fuzzy (lebih robust)
            'score': round(fuzzy_score, 2),
            
            'maturity': pred_maturity,
            'timestamp': int(time.time() * 1000)
        }

        ref_logs.push(data_to_save)
        ref_now.set(data_to_save)

        print("💾 Sukses simpan ke Firebase!")

    except Exception as e:
        print(f"⚠️ Error memproses data: {e}")

# ==========================================
# 4. LISTENER CONTROL (Actuator Backend)
# ==========================================
# global var not strictly needed if we don't cache

def control_listener(event):
    """
    Callback jika ada perubahan di Firebase path 'controls'.
    """
    print(f"\n🔔 [DEBUG] Firebase Event Detected at path: {event.path}")
    print(f"   Data: {event.data}")
    
    try:
        # Ambil full state untuk memastikan konsistensi
        full_state = db.reference('controls').get()
        if full_state is None: 
            print("   [DEBUG] State 'controls' kosong / None.")
            return

        print(f"   [DEBUG] Full Controls State: {full_state}")

        pump = 1 if full_state.get('pump') == 1 else 0
        aerator = 1 if full_state.get('aerator') == 1 else 0

        # Payload JSON ke ESP32 (FORCE MANUAL)
        payload = json.dumps({
            "pump": pump,
            "aerator": aerator,
            "auto": 0 
        })
        
        print(f"📤 [CONTROL] Mengirim ke MQTT ({MQTT_CONTROL_TOPIC}): {payload}")
        client.publish(MQTT_CONTROL_TOPIC, payload)

    except Exception as e:
        print(f"⚠️ Error di control_listener: {e}")

# ==========================================
# 5. MAIN EXECUTION
# ==========================================
print("🎧 Mendengarkan perintah Actuator dari Firebase...")
try:
    # Memasang listener pada background thread
    db.reference('controls').listen(control_listener)
except Exception as e:
    print(f"⚠️ Gagal memasang listener Firebase: {e}")

# Setup MQTT Client
client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

print("Mencoba menghubungkan ke MQTT...")
client.connect(MQTT_BROKER, 1883, 60)
client.loop_forever()