import streamlit as st
import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
from datetime import datetime
import json

# --- KONFIGURASI DAN INISIALISASI FIREBASE (DENGAN CACHE) ---
@st.cache_resource(show_spinner="Menghubungkan ke Firebase...")
def init_firebase():
    """Inisialisasi Firebase hanya sekali dan cache objeknya."""
    try:
        # Cek apakah Firebase sudah diinisialisasi sebelumnya
        if not firebase_admin._apps:
            cred = credentials.Certificate("serviceAccountKey.json")
            # Gunakan default app (tanpa nama khusus)
            firebase_admin.initialize_app(cred)
        db = firestore.client()
        return db
    except Exception as e:
        st.error(f"Gagal menginisialisasi Firebase: {e}")
        st.info("Pastikan file 'serviceAccountKey.json' ada di folder yang sama dan benar.")
        return None

# Panggil fungsi inisialisasi sekali di awal aplikasi
db = init_firebase()

# --- DATA LOGIKA FUZZY & RULE BASE ---
# Definisi himpunan fuzzy
# Format: (batas_bawah, puncak, batas_atas, [koefisien]) -> trapesium, (puncak1, puncak2, [koef]) -> segitiga
FUZZY_SETS = {
    "suhu": {
        "Dingin": (None, 25, [1, 0]),
        "Mesofilik": (25, 35, 45, [0, 1, 0]),
        "Termofilik": (45, 55, 65, [0, 1, 0]),
        "Terlalu_Panas": (65, None, [0, 1])
    },
    "kelembapan": {
        "Kering": (None, 40, [1, 0]),
        "Ideal": (40, 50, 60, [0, 1, 0]),
        "Basah": (60, None, [0, 1])
    },
    "bau": {
        "Tanah": "Tanah",
        "Anyir_Amonia": "Anyir Amonia",
        "Busuk": "Busuk",
        "Manis": "Manis"
    },
    "warna": {
        "Coklat_Muda": "Coklat Muda",
        "Coklat_Gelap": "Coklat Gelap",
        "Hitam": "Hitam"
    },
    "tekstur": {
        "Kasar": "Kasar",
        "Agak_Halus": "Agak Halus",
        "Halus": "Halus",
        "Lengket": "Lengket"
    },
    "lama_proses": {
        "Baru": (None, 7, [1, 0]),
        "Mengembang": (7, 14, 21, [0, 1, 0]),
        "Lama": (21, None, [0, 1])
    },
    "material": {
        "Hijauan_Dominan": "Hijauan Dominan",
        "Sisa_Makanan_Dominan": "Sisa Makanan Dominan",
        "Campuran": "Campuran",
        "Ada_Kontaminan": "Ada Kontaminan (Plastik/Logam)"
    }
}

# Basis aturan pakar dengan Certainty Factor
RULE_BASE = [
    # Aturan Kematangan
    {"id": "M1", "if": {"bau": "Tanah", "warna": "Hitam", "tekstur": "Halus", "lama_proses": "Lama"}, "then": {"Tingkat_Kematangan": "Matang"}, "cf": 0.90},
    {"id": "M2", "if": {"suhu": "Mesofilik", "lama_proses": "Baru"}, "then": {"Tingkat_Kematangan": "Mentah"}, "cf": 0.85},
    {"id": "M3", "if": {"suhu": "Termofilik", "lama_proses": "Mengembang"}, "then": {"Tingkat_Kematangan": "Mengembang"}, "cf": 0.80},
    # Asumsi ada input dari user untuk indeks germinasi
    # {"id": "M4", "if": {"indeks_germinasi": "Tinggi"}, "then": {"Tingkat_Kematangan": "Matang"}, "cf": 0.95},
    {"id": "M5", "if": {"material": "Ada_Kontaminan"}, "then": {"Tingkat_Kematangan": "Mentah"}, "cf": 1.00},

    # Aturan Deteksi Masalah
    {"id": "D1", "if": {"bau": "Anyir_Amonia"}, "then": {"Masalah_Deteksi": "Anaerobik"}, "cf": 0.85, "logic": "OR"},
    {"id": "D1_alt", "if": {"suhu": "Terlalu_Panas"}, "then": {"Masalah_Deteksi": "Anaerobik"}, "cf": 0.85, "logic": "OR"},
    {"id": "D2", "if": {"kelembapan": "Basah", "tekstur": "Lengket"}, "then": {"Masalah_Deteksi": "Terlalu_Basah"}, "cf": 0.90},
    {"id": "D3", "if": {"kelembapan": "Kering", "warna": "Coklat_Muda"}, "then": {"Masalah_Deteksi": "Terlalu_Kering"}, "cf": 0.80},
    {"id": "D4", "if": {"suhu": "Dingin", "lama_proses": "Lama"}, "then": {"Masalah_Deteksi": "Aerasi_Kurang"}, "cf": 0.75},
    {"id": "D5", "if": {"material": "Ada_Kontaminan"}, "then": {"Masalah_Deteksi": "Kontaminasi"}, "cf": 0.95, "logic": "OR"},
    {"id": "D5_alt", "if": {"tekstur": "Kasar"}, "then": {"Masalah_Deteksi": "Kontaminasi"}, "cf": 0.95, "logic": "OR"},

    # Aturan Rekomendasi Aksi
    {"id": "A1", "if": {"Masalah_Deteksi": "Terlalu_Basah"}, "then": {"Aksi_Rekomendasi": "Tambah_Bulking_Agent"}, "cf": 0.90},
    {"id": "A2", "if": {"Masalah_Deteksi": "Terlalu_Kering"}, "then": {"Aksi_Rekomendasi": "Tambah_Air"}, "cf": 0.85},
    {"id": "A3", "if": {"Masalah_Deteksi": "Anaerobik"}, "then": {"Aksi_Rekomendasi": "Balik_Kompos"}, "cf": 0.90},
    {"id": "A3_alt", "if": {"Masalah_Deteksi": "Aerasi_Kurang"}, "then": {"Aksi_Rekomendasi": "Balik_Kompos"}, "cf": 0.90},
    {"id": "A4", "if": {"Masalah_Deteksi": "Kontaminasi"}, "then": {"Aksi_Rekomendasi": "Buang_Kontaminan"}, "cf": 1.00},
    {"id": "A5", "if": {"Tingkat_Kematangan": "Mengembang"}, "then": {"Aksi_Rekomendasi": "Tunggu"}, "cf": 0.80}
]

# --- FUNGSI-FUNGSI LOGIKA ---
def fuzzify(inputs):
    """Mengubah input krusial menjadi nilai keanggotaan fuzzy."""
    fuzzy_inputs = {}
    for var, value in inputs.items():
        if var in FUZZY_SETS and isinstance(value, (int, float)):
            fuzzy_inputs[var] = {}
            sets = FUZZY_SETS[var]
            for label, params in sets.items():
                if isinstance(params, str): # Untuk input linguistik
                    fuzzy_inputs[var][label] = 1.0 if value == params else 0.0
                else: # Untuk input numerik
                    mu = 0.0
                    
                    # Deteksi format berdasarkan panjang tuple
                    if len(params) == 3:
                        # Format: (None, peak, [coeffs]) ATAU (start, None, [coeffs])
                        if params[0] is None and params[1] is not None:
                            # Bahu kanan: (None, peak, [coeffs])
                            # Nilai tinggi di kiri, turun ke kanan
                            peak = params[1]
                            coeffs = params[2]
                            if value <= peak:
                                mu = coeffs[0]
                            else:
                                mu = 0.0  # Di luar range
                        elif params[0] is not None and params[1] is None:
                            # Bahu kiri: (start, None, [coeffs])
                            # Nilai rendah di kiri, naik ke kanan dan tetap tinggi
                            start = params[0]
                            coeffs = params[2]
                            if value >= start:
                                # Interpolasi linear dari start ke infinity
                                # Asumsi mencapai coeffs[1] di start
                                mu = coeffs[1]
                            else:
                                mu = 0.0
                        else:
                            # Format lain yang tidak dikenali, skip
                            mu = 0.0
                    
                    elif len(params) == 4:
                        # Format trapesium: (start, peak1, peak2, [coeffs])
                        start = params[0]
                        peak1 = params[1]
                        peak2 = params[2]
                        coeffs = params[3]
                        
                        if start <= value <= peak1:
                            # Naik dari start ke peak1
                            if peak1 > start:
                                mu = coeffs[0] + (coeffs[1] - coeffs[0]) * (value - start) / (peak1 - start)
                            else:
                                mu = coeffs[1]
                        elif peak1 < value <= peak2:
                            # Plateau di puncak
                            mu = coeffs[1]
                        elif peak2 < value:
                            # Turun dari peak2 (asumsi end di infinity atau turun cepat)
                            mu = coeffs[2] if len(coeffs) > 2 else 0
                        else:
                            mu = 0.0
                    
                    fuzzy_inputs[var][label] = round(max(0, min(1, mu)), 3)
        elif var in FUZZY_SETS and isinstance(value, str):
            # Untuk input linguistik (bau, warna, tekstur, material)
            fuzzy_inputs[var] = {}
            sets = FUZZY_SETS[var]
            for label, label_value in sets.items():
                if isinstance(label_value, str):
                    fuzzy_inputs[var][label] = 1.0 if value == label_value else 0.0
    return fuzzy_inputs

def evaluate_rules(fuzzy_inputs):
    """Menjalankan mesin inferensi fuzzy."""
    fired_conclusions = {}
    for rule in RULE_BASE:
        fire_strength = 1.0
        logic_op = rule.get('logic', 'AND')

        # Evaluasi kondisi IF
        if_conditions_met = []
        for var, label in rule['if'].items():
            # Handle kasus di mana input fuzzy untuk variabel ini tidak ada
            mu_val = fuzzy_inputs.get(var, {}).get(label, 0.0)
            if_conditions_met.append(mu_val)

        if logic_op == 'AND':
            fire_strength = min(if_conditions_met)
        elif logic_op == 'OR':
            fire_strength = max(if_conditions_met)
        
        # Jika aturan aktif
        if fire_strength > 0:
            conclusion_type, conclusion_val = next(iter(rule['then'].items()))
            effective_cf = rule['cf'] * fire_strength

            if conclusion_type not in fired_conclusions:
                fired_conclusions[conclusion_type] = {}
            if conclusion_val not in fired_conclusions[conclusion_type]:
                fired_conclusions[conclusion_type][conclusion_val] = []
            
            fired_conclusions[conclusion_type][conclusion_val].append(effective_cf)
            
    return fired_conclusions

def combine_cf(conclusion_list):
    """Menggabungkan nilai Certainty Factor."""
    if not conclusion_list:
        return 0.0
    
    combined_cf = conclusion_list[0]
    for cf in conclusion_list[1:]:
        combined_cf = combined_cf + cf * (1 - combined_cf)
    return round(combined_cf, 4)

# --- FUNGSI FIREBASE ---
def save_to_firestore(inputs, results):
    """Menyimpan hasil analisis ke Firestore."""
    if not db:
        return False, "Koneksi Firebase gagal."
    try:
        doc_ref = db.collection("compost_analysis").document()
        doc_ref.set({
            "inputs": inputs,
            "results": results,
            "timestamp": datetime.now()
        })
        return True, "Analisis berhasil disimpan!"
    except Exception as e:
        return False, f"Gagal menyimpan: {e}"

def load_history():
    """Memuat riwayat analisis dari Firestore."""
    if not db:
        st.error("Koneksi Firebase gagal, tidak dapat memuat riwayat.")
        return []
    try:
        docs = db.collection("compost_analysis").order_by("timestamp", direction=firestore.Query.DESCENDING).stream()
        history = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            history.append(data)
        return history
    except Exception as e:
        st.error(f"Gagal memuat riwayat: {e}")
        return []

# --- STREAMLIT UI ---
st.set_page_config(page_title="Pakar Kompos Cerdas", layout="centered", initial_sidebar_state="expanded")

st.title("🌱 Pakar Kompos Cerdas")
st.markdown("""
Aplikasi ini akan menganalisis kualitas kompos Anda berdasarkan parameter yang Anda masukkan.
Sistem menggunakan **Logika Fuzzy** dan **Certainty Factor (CF)** untuk memberikan rekomendasi yang terpercaya.
""")

# --- SIDEBAR INPUT ---
st.sidebar.header("📊 Masukkan Data Kompos")
with st.sidebar.form("input_form"):
    st.subheader("Parameter Kritis")
    suhu = st.number_input("Suhu (°C)", value=40.0, min_value=0.0, max_value=100.0, step=0.1)
    kelembapan = st.number_input("Kelembapan (%)", value=55.0, min_value=0.0, max_value=100.0, step=0.1)
    
    st.subheader("Parameter Visual")
    bau = st.selectbox("Bau", ["Tanah", "Anyir Amonia", "Busuk", "Manis"])
    warna = st.selectbox("Warna", ["Coklat Muda", "Coklat Gelap", "Hitam"])
    tekstur = st.selectbox("Tekstur", ["Kasar", "Agak Halus", "Halus", "Lengket"])
    
    st.subheader("Parameter Proses")
    lama_proses = st.number_input("Lama Proses (Hari)", value=14, min_value=1, step=1)
    material = st.selectbox("Material Dominan", ["Hijauan Dominan", "Sisa Makanan Dominan", "Campuran", "Ada Kontaminan (Plastik/Logam)"])
    
    submitted = st.form_submit_button("Analisis Kompos Saya")

# --- LOGIKA UTAMA APLIKASI ---
if submitted:
    # 1. Kumpulkan Input
    inputs = {
        "suhu": suhu, "kelembapan": kelembapan, "bau": bau, "warna": warna,
        "tekstur": tekstur, "lama_proses": lama_proses, "material": material
    }
    
    # 2. Fuzzifikasi
    fuzzy_inputs = fuzzify(inputs)
    
    # 3. Evaluasi Aturan
    fired_conclusions = evaluate_rules(fuzzy_inputs)
    
    # 4. Kombinasi CF
    final_results = {}
    for conclusion_type, conclusions in fired_conclusions.items():
        final_results[conclusion_type] = {}
        for conclusion_val, cf_list in conclusions.items():
            final_results[conclusion_type][conclusion_val] = combine_cf(cf_list)

    # 5. Tampilkan Hasil
    st.header("📈 Hasil Analisis")
    
    # Tampilkan Status Kematangan
    status_kematangan = final_results.get("Tingkat_Kematangan", {})
    if status_kematangan:
        status, cf = max(status_kematangan.items(), key=lambda item: item[1])
        if status == "Matang":
            st.success(f"Status Kematangan: **{status}** (Keyakinan: {cf*100:.2f}%)")
        elif status == "Mengembang":
            st.warning(f"Status Kematangan: **{status}** (Keyakinan: {cf*100:.2f}%)")
        else:
            st.error(f"Status Kematangan: **{status}** (Keyakinan: {cf*100:.2f}%)")
    else:
        st.info("Status kematangan tidak dapat ditentukan.")

    # Tampilkan Masalah dan Rekomendasi
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("⚠️ Masalah Terdeteksi")
        masalah = final_results.get("Masalah_Deteksi", {})
        if masalah:
            df_masalah = pd.DataFrame(list(masalah.items()), columns=["Masalah", "Keyakinan (CF)"])
            df_masalah["Keyakinan (%)"] = (df_masalah["Keyakinan (CF)"] * 100).round(2)
            st.dataframe(df_masalah[["Masalah", "Keyakinan (%)"]], hide_index=True)
        else:
            st.success("Tidak ada masalah khusus yang terdeteksi!")

    with col2:
        st.subheader("💡 Rekomendasi Aksi")
        aksi = final_results.get("Aksi_Rekomendasi", {})
        if aksi:
            df_aksi = pd.DataFrame(list(aksi.items()), columns=["Aksi", "Keyakinan (CF)"])
            df_aksi["Keyakinan (%)"] = (df_aksi["Keyakinan (CF)"] * 100).round(2)
            st.dataframe(df_aksi[["Aksi", "Keyakinan (%)"]], hide_index=True)
        else:
            st.info("Tidak ada rekomendasi khusus.")

    # Simpan ke Firebase
    save_status, save_message = save_to_firestore(inputs, final_results)
    if save_status:
        st.sidebar.success(save_message)
    else:
        st.sidebar.error(save_message)

# --- RIWAYAT ANALISIS ---
st.header("📜 Riwayat Analisis")
if st.button("Muat Riwayat dari Firebase"):
    history_data = load_history()
    if history_data:
        for i, record in enumerate(history_data):
            with st.expander(f"Analisis {i+1} - {record['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}"):
                st.json(record)
    else:
        st.info("Belum ada riwayat analisis.")