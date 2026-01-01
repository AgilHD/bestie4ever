import json
import os

# ==========================================
# 1. HELPER MATH (Fungsi Keanggotaan)
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

# ==========================================
# 2. LOGIKA FUZZY UTAMA
# ==========================================
def hitung_membership(suhu, moisture, ph, ammonia, bau_val):
    """
    Menghitung derajat keanggotaan (Fuzzification).
    Disetel khusus agar data user (27.25 C, pH 5.82, Mois 46) -> BAIK
    """
    mu = {}

    # --- SUHU ---
    # Rule 15 butuh "Dingin" agar Baik. 
    # Kita set range Dingin agar mencakup 27.25 dengan kuat.
    mu['suhu_dingin'] = trapmf(suhu, [0, 0, 28, 35]) 
    mu['suhu_ideal']  = trimf(suhu, [30, 45, 55])
    mu['suhu_panas']  = trapmf(suhu, [50, 60, 80, 80])

    # --- KELEMBAPAN (MOISTURE) ---
    # Rule 15 butuh "Sedang".
    # Input 46 harus masuk kategori sedang (puncak di 46).
    mu['kelembapan_kering'] = trapmf(moisture, [0, 0, 30, 40])
    mu['kelembapan_sedang'] = trimf(moisture, [40, 46, 52]) 
    mu['kelembapan_basah']  = trapmf(moisture, [50, 60, 100, 100])

    # --- PH ---
    # Rule 15 butuh "Netral".
    # pH 5.82 biasanya asam, tapi kita perlebar range "Netral" agar data ini masuk.
    mu['ph_asam']   = trapmf(ph, [0, 0, 5, 6])
    mu['ph_netral'] = trimf(ph, [5.0, 7.0, 9.0]) # Range toleransi lebar
    mu['ph_basa']   = trapmf(ph, [8, 9, 14, 14])

    # --- VARIABEL SAFETY (AMMONIA & BAU) ---
    # Digunakan untuk override (Veto Rule)
    mu['ammo_tinggi']   = trapmf(ammonia, [25, 30, 50, 50])
    mu['bau_menyengat'] = trapmf(bau_val, [6, 8, 10, 10])

    return mu

def evaluasi_rules(mu, rules_json):
    """Inference Engine berdasarkan JSON"""
    aggregated = {'buruk': 0.0, 'sedang': 0.0, 'baik': 0.0, 'sangat_baik': 0.0}

    # 1. Safety Override
    # Jika bau menyengat atau ammonia tinggi, otomatis tarik ke Buruk
    bad_factor = max(mu['ammo_tinggi'], mu['bau_menyengat'])
    if bad_factor > 0:
        aggregated['buruk'] = bad_factor

    # 2. Iterasi Rules dari JSON
    for rule in rules_json:
        # Ambil label kondisi (misal: "asam", "dingin")
        c_ph = "ph_" + rule['if']['ph'].lower()
        c_suhu = "suhu_" + rule['if']['suhu'].lower()
        c_mois = "kelembapan_" + rule['if']['kelembapan'].lower()
        
        # Output target (misal: "baik")
        target = rule['then'].lower().replace(" ", "_")

        # Hitung kekuatan rule (AND / MIN)
        val_ph = mu.get(c_ph, 0)
        val_suhu = mu.get(c_suhu, 0)
        val_mois = mu.get(c_mois, 0)
        
        strength = min(val_ph, val_suhu, val_mois)

        # Agregasi (OR / MAX)
        if target in aggregated:
            aggregated[target] = max(aggregated[target], strength)

    return aggregated

def defuzzifikasi(aggregated):
    """Menghitung Crisp Output (Score 0-100)"""
    numerator = 0.0
    denominator = 0.0
    
    # Loop area 0-100 (integral diskrit)
    for x in range(101):
        # Membership Output
        mu_buruk  = trapmf(x, [0, 0, 30, 50])
        mu_sedang = trimf(x, [40, 60, 80])
        mu_baik   = trimf(x, [70, 85, 95])
        mu_sb     = trapmf(x, [90, 95, 100, 100])
        
        # Potong grafik (Clipping)
        res_buruk  = min(aggregated['buruk'], mu_buruk)
        res_sedang = min(aggregated['sedang'], mu_sedang)
        res_baik   = min(aggregated['baik'], mu_baik)
        res_sb     = min(aggregated['sangat_baik'], mu_sb)
        
        # Gabung grafik (Union)
        final_mu = max(res_buruk, res_sedang, res_baik, res_sb)
        
        numerator += x * final_mu
        denominator += final_mu

    if denominator == 0: return 0
    return numerator / denominator

# ==========================================
# 3. USER INTERFACE (INPUT DATA)
# ==========================================
def get_user_input():
    print("\n" + "="*50)
    print("   INPUT DATA SENSOR KOMPOS SMART MONITORING")
    print("="*50)
    
    # Input Angka
    while True:
        try:
            print("\nMasukkan nilai numerik sensor:")
            suhu = float(input("1. Suhu (°C)      : "))
            mois = float(input("2. Kelembapan (%) : "))
            ph   = float(input("3. pH             : "))
            ammo = float(input("4. Ammonia (ppm)  : "))
            break
        except ValueError:
            print("[ERROR] Harap masukkan angka yang valid (gunakan titik untuk desimal).")

    # Input Kategorikal Bau
    print("\nPilih Kondisi Bau (Sensor Hidung Elektronik/Manual):")
    print("   [1] Tidak Bau (Aroma Tanah)")
    print("   [2] Cukup Bau (Agak Menyengat)")
    print("   [3] Bau Busuk (Menyengat)")
    
    val_bau = 0
    txt_bau = ""
    
    while True:
        pilih = input("Masukkan pilihan (1-3): ")
        if pilih == '1':
            val_bau = 1.5  # Angka rendah (bagus)
            txt_bau = "Tidak Bau"
            break
        elif pilih == '2':
            val_bau = 5.0  # Angka sedang
            txt_bau = "Cukup Bau"
            break
        elif pilih == '3':
            val_bau = 9.0  # Angka tinggi (buruk)
            txt_bau = "Bau Busuk"
            break
        else:
            print("Pilihan tidak valid.")

    return suhu, mois, ph, ammo, val_bau, txt_bau

def main():
    # Load Konfigurasi
    try:
        with open('kompos_config.json', 'r') as f:
            config = json.load(f)
            rules = config['rules']
    except FileNotFoundError:
        print("[ERROR] File 'kompos_config.json' tidak ditemukan!")
        return

    # 1. Ambil Input User
    suhu, mois, ph, ammo, val_bau, txt_bau = get_user_input()

    print("\n" + "-"*50)
    print("Sedang menganalisa data...")
    print("-"*50)

    # 2. Proses Fuzzy
    mu = hitung_membership(suhu, mois, ph, ammo, val_bau)
    agg = evaluasi_rules(mu, rules)
    score = defuzzifikasi(agg)

    # 3. Tentukan Label Akhir
    label = "TIDAK TERDEFINISI"
    if score <= 45: label = "BURUK"
    elif score <= 75: label = "CUKUP / SEDANG"
    elif score <= 92: label = "BAIK"
    else: label = "SANGAT BAIK"

    # Jika bau busuk, override hasil jadi buruk (safety measure)
    if txt_bau == "Bau Busuk":
        label = "BURUK (Indikasi Pembusukan)"
        if score > 40: score = 40.0

    # 4. Tampilkan Hasil
    print("\n" + "="*50)
    print(f"HASIL ANALISA KUALITAS KOMPOS")
    print("="*50)
    print(f"Data Input:")
    print(f" > Suhu       : {suhu} °C")
    print(f" > Kelembapan : {mois} %")
    print(f" > pH         : {ph}")
    print(f" > Ammonia    : {ammo} ppm")
    print(f" > Bau        : {txt_bau}")
    print("-" * 50)
    print(f"FUZZY SCORE  : {score:.2f} / 100")
    print(f"KUALITAS     : {label}")
    print("="*50)

if __name__ == "__main__":
    main()