#include <WiFi.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ==========================================
// 1. KONFIGURASI WIFI & MQTT
// ==========================================
const char* ssid = "AAA";          // Ganti WiFi
const char* password = "87654321"; // Ganti Password

const char* mqtt_server = "broker.hivemq.com";
const char* mqtt_topic = "talha/sensor"; 

// ==========================================
// 2. KONFIGURASI SENSOR
// ==========================================

// --- A. Sensor Suhu Tanah (DS18B20) ---
// Pastikan ada Resistor 4.7k Ohm antara kabel Data (Kuning) dan VCC (Merah)
#define ONE_WIRE_BUS 15 
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// --- B. Sensor Kelembaban & pH (Analog) ---
#define MOISTURE_PIN 32  // Sensor Kelembaban Tanah
#define PH_PIN 34        // Sensor pH Tanah

// --- C. Kalibrasi (Sesuaikan Nilai Ini) ---
const int dryVal = 4095; // Nilai saat kering
const int wetVal = 1500; // Nilai saat di air

WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastMsg = 0; 

// ==========================================
// 3. FUNGSI WIFI & MQTT
// ==========================================

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Menghubungkan ke WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Terhubung!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Menghubungkan ke MQTT Broker...");
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("Berhasil Konek!");
    } else {
      Serial.print("Gagal, rc=");
      Serial.print(client.state());
      Serial.println(" coba lagi 5 detik");
      delay(5000);
    }
  }
}

// ==========================================
// 4. SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  
  // Start Sensor Suhu DS18B20
  sensors.begin();
  
  // Setup Pin Analog
  pinMode(MOISTURE_PIN, INPUT);
  pinMode(PH_PIN, INPUT);
  
  setup_wifi();
  client.setServer(mqtt_server, 1883);
}

// ==========================================
// 5. LOOP UTAMA
// ==========================================
void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  
  // Kirim data setiap 3 detik
  if (now - lastMsg > 3000) {
    lastMsg = now;

    // --- 1. BACA SUHU TANAH (DS18B20) ---
    sensors.requestTemperatures(); 
    float suhuTanah = sensors.getTempCByIndex(0);

    // Cek jika sensor suhu error/tidak terpasang (-127 artinya error)
    if (suhuTanah == -127.00) {
      Serial.println("Error: Sensor Suhu Tanah tidak terdeteksi!");
    }

    // --- 2. BACA MOISTURE (Tanah) ---
    int moistureRaw = analogRead(MOISTURE_PIN);
    int moisturePercent = map(moistureRaw, dryVal, wetVal, 0, 100);
    moisturePercent = constrain(moisturePercent, 0, 100);

    // --- 3. BACA PH (Tanah) ---
    int phRaw = analogRead(PH_PIN);
    float voltasePH = (float)phRaw * 3.3 / 4095.0;
    // Rumus Kalibrasi pH (Sesuaikan angka 7.0 dan 2.5 dengan kondisi alatmu)
    float phValue = 7.0 + ((2.5 - voltasePH) / 0.18); 

    // --- 4. KIRIM DATA (JSON) ---
    // Format: {"suhu_tanah": 28.5, "moisture": 60, "ph": 6.8}
    String payload = "{";
    payload += "\"suhu_tanah\":"; payload += String(suhuTanah);
    payload += ", \"moisture\":"; payload += String(moisturePercent);
    payload += ", \"ph\":"; payload += String(phValue);
    payload += "}";

    Serial.print("Data Sensor: ");
    Serial.println(payload);

    client.publish(mqtt_topic, payload.c_str());
  }
}
