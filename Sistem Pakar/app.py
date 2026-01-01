from flask import Flask, render_template, request, jsonify
import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl

app = Flask(__name__)

# ==========================================
# 1. FUZZY LOGIC CONFIGURATION
# ==========================================
# Antecednets (Inputs)
suhu = ctrl.Antecedent(np.arange(0, 101, 1), 'suhu')
kelembapan = ctrl.Antecedent(np.arange(0, 101, 1), 'kelembapan')
ph = ctrl.Antecedent(np.arange(0, 15, 0.1), 'ph')

# Consequent (Output)
status_kompos = ctrl.Consequent(np.arange(0, 101, 1), 'status_kompos')

# Membership Functions (Sesuai user request)
# Kelembapan
kelembapan['kering'] = fuzz.trapmf(kelembapan.universe, [0, 0, 30, 40])
kelembapan['sedang'] = fuzz.trimf(kelembapan.universe, [40, 45, 50])
kelembapan['basah'] = fuzz.trapmf(kelembapan.universe, [50, 60, 80, 100]) # Extend to 100 for safety

# Suhu
suhu['dingin'] = fuzz.trapmf(suhu.universe, [0, 0, 20, 30])
suhu['ideal'] = fuzz.trimf(suhu.universe, [30, 40, 50])
suhu['panas'] = fuzz.trapmf(suhu.universe, [50, 60, 100, 100]) # Extend to 100

# pH
ph['asam'] = fuzz.trapmf(ph.universe, [0, 0, 5, 6]) # Extend to 0
ph['netral'] = fuzz.trimf(ph.universe, [6, 6.75, 7.5])
ph['basa'] = fuzz.trapmf(ph.universe, [7, 8, 14, 14]) # Extend to 14

# Status Kompos
status_kompos['buruk'] = fuzz.trapmf(status_kompos.universe, [0, 0, 30, 50])
status_kompos['sedang'] = fuzz.trimf(status_kompos.universe, [40, 60, 80])
status_kompos['baik'] = fuzz.trimf(status_kompos.universe, [70, 85, 95])
status_kompos['sangat_baik'] = fuzz.trapmf(status_kompos.universe, [90, 95, 100, 100])

# RULES (Matching config_fis.json)
rules = [
    # Buruk (1-6)
    ctrl.Rule(ph['asam'] & suhu['dingin'] & kelembapan['basah'], status_kompos['buruk']),
    ctrl.Rule(ph['asam'] & suhu['panas'] & kelembapan['kering'], status_kompos['buruk']),
    ctrl.Rule(ph['basa'] & suhu['dingin'] & kelembapan['basah'], status_kompos['buruk']),
    ctrl.Rule(ph['basa'] & suhu['panas'] & kelembapan['kering'], status_kompos['buruk']),
    ctrl.Rule(ph['asam'] & suhu['ideal'] & kelembapan['basah'], status_kompos['buruk']),
    ctrl.Rule(ph['basa'] & suhu['ideal'] & kelembapan['basah'], status_kompos['buruk']),

    # Sedang (7-12)
    ctrl.Rule(ph['asam'] & suhu['ideal'] & kelembapan['sedang'], status_kompos['sedang']),
    ctrl.Rule(ph['basa'] & suhu['ideal'] & kelembapan['sedang'], status_kompos['sedang']),
    ctrl.Rule(ph['netral'] & suhu['dingin'] & kelembapan['sedang'], status_kompos['sedang']),
    ctrl.Rule(ph['netral'] & suhu['ideal'] & kelembapan['basah'], status_kompos['sedang']),
    ctrl.Rule(ph['netral'] & suhu['panas'] & kelembapan['kering'], status_kompos['sedang']),
    ctrl.Rule(ph['asam'] & suhu['panas'] & kelembapan['sedang'], status_kompos['sedang']),

    # Baik (13-15)
    ctrl.Rule(ph['netral'] & suhu['ideal'] & kelembapan['kering'], status_kompos['baik']),
    ctrl.Rule(ph['netral'] & suhu['panas'] & kelembapan['sedang'], status_kompos['baik']),
    ctrl.Rule(ph['netral'] & suhu['dingin'] & kelembapan['sedang'], status_kompos['baik']), # Overlap with rule 9? JSON has duplicates/overlaps implies OR logic
    
    # Sangat Baik (16)
    ctrl.Rule(ph['netral'] & suhu['ideal'] & kelembapan['sedang'], status_kompos['sangat_baik'])
]

penentu_kompos_ctrl = ctrl.ControlSystem(rules)
penentu_kompos = ctrl.ControlSystemSimulation(penentu_kompos_ctrl)

# ==========================================
# 2. LOGIC FUNCTION
# ==========================================
def hitung_fis(val_suhu, val_ph, val_lembab):
    try:
        # Input ke sistem fuzzy
        penentu_kompos.input['suhu'] = float(val_suhu)
        penentu_kompos.input['ph'] = float(val_ph)
        penentu_kompos.input['kelembapan'] = float(val_lembab)

        # Hitung
        penentu_kompos.compute()
        
        skor = penentu_kompos.output['status_kompos']
        
        # Klasifikasi Teks
        label = "Tidak Terdefinisi"
        if skor <= 45: label = "Buruk"
        elif skor <= 75: label = "Sedang"
        elif skor <= 92: label = "Baik"
        else: label = "Sangat Baik"
        
        return float(skor), label
    except Exception as e:
        print(f"Error Kalkulasi Fuzzy: {e}")
        return 0, "Error"

# ==========================================
# 3. FLASK ROUTES
# ==========================================
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/calculate', methods=['POST'])
def calculate():
    data = request.json
    suhu_val = data.get('suhu')
    ph_val = data.get('ph')
    kelembapan_val = data.get('kelembapan')
    
    if suhu_val is None or ph_val is None or kelembapan_val is None:
        return jsonify({'error': 'Missing values'}), 400
        
    score, label = hitung_fis(suhu_val, ph_val, kelembapan_val)
    
    return jsonify({
        'score': round(score, 2),
        'label': label,
        'inputs': {
            'suhu': suhu_val,
            'ph': ph_val,
            'kelembapan': kelembapan_val
        }
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
