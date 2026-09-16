# Recovra (HealthGuard) — Asisten Pemulihan & Kesehatan

Aplikasi web untuk memantau kondisi kesehatan, mendapatkan rekomendasi nutrisi & aktivitas, mengelola jadwal/pengingat, dan berkonsultasi dengan asisten AI selama masa pemulihan.

## Fitur Utama

- **Dashboard** — ringkasan Recovery Score, jadwal hari ini, tren nyeri
- **Cek Kondisi** — input gejala bebas, dapat rekomendasi instan
- **Monitoring Kesehatan** — catat nyeri, suhu, mobilitas harian + grafik tren
- **Nutrisi & Aktivitas** — rekomendasi berdasarkan kondisi kesehatan
- **Medicine** — info umum obat bebas (bukan resep/diagnosis)
- **Jadwal & Pengingat** — kalender dan notifikasi browser
- **Asisten AI** — chat multi-percakapan (seperti ChatGPT/Claude), didukung Groq API dengan fallback offline rule-based jika server AI tidak aktif

## Tech Stack

- Frontend: HTML, CSS, JavaScript (vanilla, tanpa framework)
- Backend: Node.js + Express (`js/server.js`) — menyajikan file statis dan endpoint `/api/chat`
- AI: Groq API (endpoint OpenAI-compatible)
- Penyimpanan data: `localStorage` browser (lihat bagian Keterbatasan)

## Cara Menjalankan

1. Install dependencies:
   ```
   npm install
   ```
2. Salin `.env.example` menjadi `.env`, isi API key Groq kamu (dari https://console.groq.com/keys):
   ```
   AI_API_KEY=your_api_key_here
   AI_MODEL=openai/gpt-oss-120b
   PORT=3000
   ```
3. Jalankan server:
   ```
   npm start
   ```
4. Buka `http://localhost:3000` di browser.

Jika server AI tidak dijalankan atau `.env` belum diisi, fitur chat tetap berfungsi menggunakan mesin jawaban offline (rule-based).

## Backup Data

Karena data tersimpan di `localStorage` (per-browser, per-device), gunakan menu **Pengaturan → Export Data** untuk mengunduh backup, dan **Import Data** untuk memulihkannya di device/browser lain.

## Keterbatasan

- Data hanya tersimpan lokal di browser (tidak ada database server), sehingga tidak otomatis sinkron antar-device.
- Informasi obat dan rekomendasi kesehatan bersifat umum, bukan pengganti diagnosis atau resep dokter.

## Struktur Folder

```
healthguard/
├── index.html
├── css/style.css
├── js/            # app.js, health.js, checkup.js, nutrition.js, medicine.js,
│                  # activity.js, calendar.js, notifications.js, chatbot.js, server.js
├── data/          # foods.json, exercises.json, medicines.json
└── assets/
```
