# MQTT to Firebase Bridge - Project Akhir

Program ini adalah *bridge* (jembatan) yang menghubungkan **MQTT Broker** dengan **Firebase Realtime Database**. Program ini membaca data sensor yang dikirim via MQTT, menampungnya (buffer) selama 10 menit, menghitung rata-rata, lalu mengirimkannya ke Firebase.

## 🚀 Fitur

- **Realtime Listener**: Mendengarkan topic MQTT `talha/sensor` secara terus menerus.
- **Data Buffering**: Mengumpulkan data sensor selama 10 menit.
- **Average Calculation**: Menghitung rata-rata dari semua data yang masuk dalam rentang 10 menit untuk akurasi yang lebih baik.
- **Dual Database Update**:
  - `sensor_logs`: Menyimpan riwayat data (history) rata-rata per 10 menit.
  - `sensor_now`: Memperbarui status terkini dengan data rata-rata terbaru.
- **Visual Feedback**: Menampilkan log status di terminal (Terhubung, Terima Data, Mengumpulkan, Kirim).

## 🛠️ Persyaratan

- Python 3.x
- Koneksi Internet
- Library Python:
  - `firebase-admin`
  - `paho-mqtt`

## 📦 Instalasi

1. Clone repository ini atau copy folder project.
2. Install library yang dibutuhkan:

    ```bash
    pip install firebase-admin paho-mqtt
    ```

3. **PENTING**: Pastikan file kredensial Firebase (JSON) ada di dalam folder project.
    - Nama file default di kode: `komposproject-dfe5e-firebase-adminsdk-fbsvc-07b42ceab7.json`
    - Jika nama file berbeda, sesuaikan variabel `JSON_KEY_FILE` di dalam `Project.py`.

## ⚙️ Konfigurasi

Anda dapat mengubah konfigurasi berikut di bagian atas file `Project.py`:

- **MQTT_BROKER**: Alamat broker MQTT (Default: `broker.hivemq.com`)
- **MQTT_TOPIC**: Topic yang didengarkan (Default: `talha/sensor`)
- **SEND_INTERVAL**: Interval pengiriman ke Firebase dalam detik (Default: `600` = 10 menit)

## ▶️ Cara Menjalankan

Jalankan script menggunakan Python:

```bash
python Project.py
```

Jika berhasil, akan muncul pesan:

```
Menjalankan Bridge MQTT -> Firebase...
Terhubung ke MQTT Broker! Code: 0
Mendengarkan topic: talha/sensor...
```

## 📝 Struktur Data

Data yang dikirim ke MQTT diharapkan dalam format JSON string. Contoh:

```json
{"temperature": 25.5, "humidity": 60}
```

Program akan otomatis mendeteksi field numerik (int/float) untuk dirata-rata.

## ⚠️ Troubleshooting

- **ModuleNotFoundError**: Jalankan `pip install firebase-admin paho-mqtt`.
- **FileNotFoundError (JSON Key)**: Pastikan file JSON dari Firebase Console sudah didownload dan diletakkan di folder yang sama dengan `Project.py`.
