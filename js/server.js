/**
 * Recovra AI — server Express yang menyajikan DUA hal sekaligus:
 * 1. File-file aplikasi (index.html, css, js, data) — jadi cukup SATU link untuk dibuka.
 * 2. Endpoint /api/chat yang nyambung ke AI (Groq).
 *
 * Cara pakai lokal:
 * 1. npm install
 * 2. copy .env.example -> .env, isi AI_API_KEY punyamu (dari console.groq.com/keys)
 * 3. node js/server.js   (atau: npm start)
 * 4. buka http://localhost:3000 di browser (BUKAN buka index.html langsung).
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

const PORT = process.env.PORT || 3000;
const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-oss-120b';
const AI_ENDPOINT = process.env.AI_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';

if (!AI_API_KEY) {
  console.warn('\n⚠️  AI_API_KEY belum diisi.');
  console.warn('   Buat file .env (contoh ada di .env.example) lalu isi AI_API_KEY=xxxx.\n');
}

const SYSTEM_INSTRUCTION = `Kamu adalah Recovra AI, asisten pendamping di aplikasi kesehatan Recovra.
Tugasmu membantu pengguna soal: makanan yang cocok, aktivitas/olahraga ringan yang aman, cara pakai fitur aplikasi (Nutrisi, Aktivitas, Jadwal, Cek Kondisi), dan info UMUM obat bebas — untuk kondisi seperti cedera fisik, demam, flu/pilek, peradangan sendi, atau pemulihan umum.

Gaya bicara: hangat, natural, dan luwes seperti manusia asli, pakai Bahasa Indonesia sehari-hari (boleh sedikit santai/gaul, jangan kaku atau terlalu formal). Jawaban ringkas saja (idealnya 2-5 kalimat) karena tampil di gelembung chat kecil di HP. Jangan pakai heading atau bullet point panjang, cukup kalimat mengalir.

Batasan penting:
- Kamu BUKAN dokter, tidak boleh memberi diagnosis pasti atau menuliskan resep obat.
- Untuk pertanyaan soal obat, cukup beri info umum (jenis, fungsi umum) dan selalu ingatkan baca label kemasan serta tanya apoteker/dokter kalau ragu, hamil, atau sedang rutin minum obat lain.
- Kalau pengguna menyebut tanda bahaya (sesak berat, pingsan, kejang, perdarahan banyak, tidak sadar, bibir biru), langsung sarankan cari pertolongan medis darurat sekarang juga, jangan berbasa-basi dulu.
- Kalau pengguna curhat di luar topik kesehatan, tetap boleh ditanggapi ramah secukupnya, lalu arahkan pelan-pelan kembali ke topik pemulihan/kesehatan.`;

app.post('/api/chat', async (req, res) => {
  try {
    if (!AI_API_KEY) {
      return res.status(500).json({ error: 'Server belum dikonfigurasi: AI_API_KEY kosong. Cek file .env.' });
    }

    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Payload messages kosong atau tidak valid.' });
    }

    const chatMessages = [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      ...messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }))
    ];

    const aiRes = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: chatMessages
      })
    });

    const data = await aiRes.json();

    if (!aiRes.ok) {
      console.error('Error AI Server:', JSON.stringify(data));
      return res.status(500).json({ error: data.error?.message || 'Gagal memproses AI di server.' });
    }

    const replyText = data.choices?.[0]?.message?.content
      || 'Maaf, aku belum bisa jawab itu sekarang. Coba tanya dengan cara lain ya.';

    res.json({ reply: replyText });
  } catch (error) {
    console.error('Error AI Server:', error?.message || error);
    res.status(500).json({ error: 'Gagal memproses AI di server.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasKey: Boolean(AI_API_KEY), model: AI_MODEL });
});

app.listen(PORT, () => {
  console.log(`🚀 Recovra AI berjalan di http://localhost:${PORT}  (buka link ini di browser)`);
  console.log(`   Model: ${AI_MODEL}`);
});