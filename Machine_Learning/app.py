from flask import Flask, Response, jsonify, request
from flask_cors import CORS
import cv2
import mediapipe as mp
import time

app = Flask(__name__)
# Mengizinkan akses dari React (biasanya di localhost:3000 atau localhost:5173)
CORS(app)

# --- Setup MediaPipe ---
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(min_detection_confidence=0.7, min_tracking_confidence=0.5)
mp_draw = mp.solutions.drawing_utils

# --- Variabel Global ---
camera = cv2.VideoCapture(0)

# Data User Sementara
user_data = {"name": "", "nim": ""}
current_item = ""

# Status Aplikasi
app_mode = "idle" 
process_status = None 

# Variabel Timer
state_start_time = None
current_gesture_state = None 
REQUIRED_HOLD_TIME = 2.0 

def count_fingers(hand_landmarks):
    tip_ids = [4, 8, 12, 16, 20]
    fingers = []
    
    # Jempol (Logika untuk tangan kanan, bisa dibalik jika perlu)
    if hand_landmarks.landmark[tip_ids[0]].x < hand_landmarks.landmark[tip_ids[0] - 1].x:
        fingers.append(1)
    else:
        fingers.append(0)
    
    # 4 Jari Lainnya
    for id in range(1, 5):
        if hand_landmarks.landmark[tip_ids[id]].y < hand_landmarks.landmark[tip_ids[id] - 2].y:
            fingers.append(1)
        else:
            fingers.append(0)
    
    return fingers.count(1)

def generate_frames():
    global app_mode, process_status, state_start_time, current_gesture_state
    
    while True:
        success, frame = camera.read()
        if not success:
            break
        
        frame = cv2.flip(frame, 1)
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(img_rgb)
        
        # --- LOGIKA UTAMA ---
        if app_mode != "idle" and process_status is None:
            
            # Header Text di Video
            header_text = "MODE: REGISTRASI" if app_mode == 'register_scan' else "MODE: PEMBAYARAN"
            cv2.putText(frame, header_text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 0), 2)
            
            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)
                    total_fingers = count_fingers(hand_landmarks)
                    
                    target_state = None
                    color = (255, 255, 255)
                    msg = ""

                    # --- MODE REGISTRASI ---
                    if app_mode == 'register_scan':
                        if total_fingers == 5:
                            target_state = 'validating_reg'
                            msg = "TAHAN 5 JARI..."
                            color = (0, 255, 0)
                        else:
                            msg = "Tunjukkan 5 Jari"
                            color = (0, 255, 255)

                    # --- MODE PEMBAYARAN ---
                    elif app_mode == 'payment_scan':
                        if total_fingers == 5:
                            target_state = 'validating_pay_success'
                            msg = "VERIFIKASI..."
                            color = (0, 255, 0)
                        elif total_fingers == 3 or total_fingers == 4:
                            target_state = 'validating_pay_fail'
                            msg = "CEK DATABASE..."
                            color = (0, 0, 255) 
                        else:
                            msg = "Scan Jari Anda"
                            color = (0, 255, 255)

                    # --- TIMER PROSES ---
                    if target_state:
                        if current_gesture_state != target_state:
                            current_gesture_state = target_state
                            state_start_time = time.time()
                        
                        elapsed = time.time() - state_start_time
                        
                        # Loading Bar Visual
                        bar_width = int(300 * (elapsed/REQUIRED_HOLD_TIME))
                        cv2.rectangle(frame, (50, 60), (50 + bar_width, 80), color, -1)
                        cv2.rectangle(frame, (50, 60), (350, 80), (255, 255, 255), 2)
                        cv2.putText(frame, msg, (50, 110), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)

                        if elapsed >= REQUIRED_HOLD_TIME:
                            if target_state == 'validating_reg':
                                process_status = 'reg_success'
                            elif target_state == 'validating_pay_success':
                                process_status = 'pay_success'
                            elif target_state == 'validating_pay_fail':
                                process_status = 'pay_failed'
                    else:
                        current_gesture_state = None
                        state_start_time = None
                        cv2.putText(frame, msg, (20, 400), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
            else:
                current_gesture_state = None
                cv2.putText(frame, "Arahkan Tangan...", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        
        # --- FEEDBACK HASIL AKHIR ---
        if process_status == 'reg_success':
            cv2.putText(frame, "TERDAFTAR!", (150, 240), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 0), 4)
        elif process_status == 'pay_success':
            cv2.putText(frame, "LUNAS!", (200, 240), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 0), 4)
        elif process_status == 'pay_failed':
            cv2.putText(frame, "GAGAL!", (200, 240), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 255), 4)

        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()
        yield (b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

# Rute halaman utama agar tidak 404 saat dibuka di browser
@app.route('/')
def index():
    return "Backend Flask Aktif! Silakan buka Frontend React (biasanya http://localhost:5173) untuk menggunakan aplikasi."

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/submit_registration', methods=['POST'])
def submit_registration():
    global user_data, app_mode, process_status, state_start_time
    data = request.json
    user_data['name'] = data.get('name')
    user_data['nim'] = data.get('nim')
    app_mode = 'register_scan'
    process_status = None
    state_start_time = None
    return jsonify({"message": "Registration started", "status": "ok"})

@app.route('/start_payment', methods=['POST'])
def start_payment():
    global current_item, app_mode, process_status, state_start_time
    data = request.json
    current_item = data.get('item')
    app_mode = 'payment_scan'
    process_status = None
    state_start_time = None
    return jsonify({"message": "Payment started", "status": "ok"})

@app.route('/reset_app', methods=['POST'])
def reset_app():
    global app_mode, process_status
    app_mode = "idle"
    process_status = None
    return jsonify({"message": "Reset done"})

@app.route('/check_status')
def check_status():
    global process_status
    if process_status:
        # Kembalikan status dan reset status internal agar tidak loop
        current_status = process_status
        return jsonify({"status": current_status, "user": user_data})
    return jsonify({"status": "waiting"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)