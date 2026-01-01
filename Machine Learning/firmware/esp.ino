#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ==========================================
// 1. WIFI & MQTT
// ==========================================
const char* ssid = "Wokwi-GUEST";
const char* password = "";

const char* mqtt_server = "broker.hivemq.com";
const char* mqtt_topic  = "talha/sensor";

WiFiClient espClient;
PubSubClient client(espClient);

// ==========================================
// 2. PIN SENSOR (SEMUA POTENSIO)
// ==========================================

// Potensio 1: Suhu (Ganti DHT22)
#define TEMP_PIN 35

// Potensio 2: Soil Moisture
#define MOISTURE_PIN 32

// Potensio 3: pH
#define PH_PIN 34

// OUTPUT
#define BUZZER_PIN 27
#define RELAY_CH1_PIN 33
#define RELAY_CH2_PIN 25

// ==========================================
// 3. LCD I2C
// ==========================================
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ==========================================
// 4. VARIABEL TIMER
// ==========================================
unsigned long lastSend = 0;
unsigned long relay1LastToggle = 0;
bool relay1State = false; 

// ==========================================
// 5. SETUP & WIFI
// ==========================================
void setup_wifi() {
  Serial.print("Menghubungkan WiFi ");
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" Connected!");
}

void reconnect() {
  while (!client.connected()) {
    String cid = "ESP32-" + String(random(0xffff), HEX);
    if (client.connect(cid.c_str())) {
      Serial.println("MQTT Connected");
    } else {
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Setup Pin Input (Potensio)
  pinMode(TEMP_PIN, INPUT);
  pinMode(MOISTURE_PIN, INPUT);
  pinMode(PH_PIN, INPUT);

  // Setup Pin Output
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RELAY_CH1_PIN, OUTPUT);
  pinMode(RELAY_CH2_PIN, OUTPUT);

  // Default OFF (Relay Active Low -> HIGH = Mati)
  digitalWrite(RELAY_CH1_PIN, HIGH);
  digitalWrite(RELAY_CH2_PIN, HIGH);
  digitalWrite(BUZZER_PIN, LOW);

  // LCD Init
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Mode: 3 Potensio");
  delay(2000);
  lcd.clear();

  setup_wifi();
  client.setServer(mqtt_server, 1883);
}

// ==========================================
// 6. LOOP UTAMA
// ==========================================
void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  // --- LOGIKA RELAY (Tetap jalan) ---
  if (millis() - relay1LastToggle >= 5000) {
    relay1LastToggle = millis();
    relay1State = !relay1State;
    digitalWrite(RELAY_CH1_PIN, relay1State ? LOW : HIGH); // Low = ON
    digitalWrite(RELAY_CH2_PIN, relay1State ? HIGH : LOW);
  }

  // --- BACA DATA & KIRIM (Setiap 2 detik) ---
  if (millis() - lastSend > 2000) {
    lastSend = millis();

    // 1. BACA SUHU (Potensio 1)
    // Raw: 0-4095, Map ke: 0-100 Celcius
    int rawTemp = analogRead(TEMP_PIN);
    int suhu = map(rawTemp, 0, 4095, 0, 100); 

    // 2. BACA MOISTURE (Potensio 2)
    // Raw: 0-4095, Map ke: 0-100 Persen
    int rawMoist = analogRead(MOISTURE_PIN);
    int moisture = map(rawMoist, 0, 4095, 0, 100);

    // 3. BACA PH (Potensio 3)
    // Raw: 0-4095, Map ke: 0-14 pH
    int rawPh = analogRead(PH_PIN);
    // Menggunakan float untuk pH agar ada koma
    float ph = rawPh * (14.0 / 4095.0); 

    // --- FITUR BUZZER (Jika suhu > 30) ---
    if (suhu > 30) {
      tone(BUZZER_PIN, 1000, 100);
    } else {
      noTone(BUZZER_PIN);
    }

    // --- TAMPILKAN DI SERIAL ---
    Serial.printf("Suhu: %d C | Moist: %d %% | pH: %.2f\n", suhu, moisture, ph);

    // --- TAMPILKAN DI LCD ---
    lcd.clear();
    lcd.setCursor(0,0);
    lcd.printf("T:%dC M:%d%%", suhu, moisture);
    lcd.setCursor(0,1);
    lcd.printf("pH:%.1f R:%d", ph, relay1State ? 1 : 2);

    // --- KIRIM JSON (Tanpa pemrosesan rumit) ---
    // Format: {"suhu": 32, "moisture": 60, "ph": 7.5}
    String payload = "{";
    payload += "\"suhu\":" + String(suhu) + ",";
    payload += "\"moisture\":" + String(moisture) + ",";
    payload += "\"ph\":" + String(ph, 2);
    payload += "}";

    client.publish(mqtt_topic, payload.c_str());
  }
}