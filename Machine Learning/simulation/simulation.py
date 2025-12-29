import time
import random
import datetime
import json
try:
    import requests
except ImportError:
    print("Requests module not found. Installing...")
    import pip
    pip.main(['install', 'requests'])
    import requests

# Configuration
DATABASE_URL = 'https://komposproject-dfe5e-default-rtdb.asia-southeast1.firebasedatabase.app'

# Status Logic
def predict_maturity(humidity, temp, ph):
    # Logic: 
    # Optimal: pH 6.5-7.5, Temp 35-50, Humidity 40-60
    
    score = 0
    if 6.0 <= ph <= 8.0: score += 1
    if 30 <= temp <= 60: score += 1
    if 40 <= humidity <= 70: score += 1
    
    # ML Probability (simulated)
    base_prob = 50
    if score == 3:
        status = "Matang"
        probability = random.randint(80, 99)
    elif score == 2:
        status = "Transisi"
        probability = random.randint(50, 79)
    else:
        status = "Belum Matang"
        probability = random.randint(10, 49)
        
    return status, probability

def simulate_sensor():
    print(f"Starting Sensor Simulation... pushing to {DATABASE_URL}")
    print("Press Ctrl+C to stop")
    
    while True:
        humidity = round(random.uniform(30.0, 80.0), 1)
        temp = round(random.uniform(25.0, 65.0), 1)
        ph = round(random.uniform(4.0, 9.0), 1)
        
        status, prob = predict_maturity(humidity, temp, ph)
        
        data = {
            "timestamp": datetime.datetime.now().isoformat(),
            "sensors": {
                "humidity": humidity,
                "temperature": temp,
                "ph": ph
            },
            "prediction": {
                "status": status,
                "confidence": prob,
                "narrative": f"Kondisi saat ini {status} dengan probabilitas {prob}%."
            }
        }
        
        print(f"Sending Update: {data['sensors']} | {data['prediction']['status']}")
        
        # Using REST API to avoid needing ServiceAccountKey for simple prototypes
        # Note: This requires Database Rules to be open "read: true, write: true" 
        # or authenticated. For this demo, we assume testing mode.
        try:
            # PUT requests replace the data at the target location
            response = requests.put(f"{DATABASE_URL}/.json", json=data)
            if response.status_code == 200:
                print(" -> Success (Data pushed to Firebase)")
            else:
                print(f" -> Failed: {response.status_code} {response.text}")
        except Exception as e:
            print(f" -> Connection Error: {e}")
        
        time.sleep(3) 

if __name__ == "__main__":
    simulate_sensor()
