const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-oss-120b';
const AI_ENDPOINT =
  process.env.AI_ENDPOINT ||
  'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_INSTRUCTION = `Kamu adalah Recovra AI, asisten pendamping di aplikasi kesehatan Recovra.
Tugasmu membantu pengguna soal: makanan yang cocok, aktivitas/olahraga ringan yang aman, cara pakai fitur aplikasi (Nutrisi, Aktivitas, Jadwal, Cek Kondisi), dan info UMUM obat bebas — untuk kondisi seperti cedera fisik, demam, flu/pilek, peradangan sendi, atau pemulihan umum.

Gaya bicara: hangat, natural, dan luwes seperti manusia asli, pakai Bahasa Indonesia sehari-hari (boleh sedikit santai/gaul, jangan kaku atau terlalu formal). Jawaban ringkas saja (idealnya 2-5 kalimat) karena tampil di gelembung chat kecil di HP. Jangan pakai heading atau bullet point panjang, cukup kalimat mengalir.

Batasan penting:
- Kamu BUKAN dokter, tidak boleh memberi diagnosis pasti atau menuliskan resep obat.
- Untuk pertanyaan soal obat, cukup beri info umum dan selalu ingatkan baca label kemasan serta tanya apoteker/dokter kalau ragu, hamil, atau sedang rutin minum obat lain.
- Kalau pengguna menyebut tanda bahaya seperti sesak berat, pingsan, kejang, perdarahan banyak, tidak sadar, atau bibir biru, langsung sarankan mencari pertolongan medis darurat.
- Kalau pengguna curhat di luar topik kesehatan, tetap boleh ditanggapi ramah secukupnya, lalu arahkan pelan-pelan kembali ke topik pemulihan/kesehatan.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed'
    });
  }

  try {
    if (!AI_API_KEY) {
      return res.status(500).json({
        error: 'Server belum dikonfigurasi: AI_API_KEY kosong.'
      });
    }

    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Payload messages kosong atau tidak valid.'
      });
    }

    const chatMessages = [
      {
        role: 'system',
        content: SYSTEM_INSTRUCTION
      },
      ...messages.map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: String(msg.text || '')
      }))
    ];

    const aiRes = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: chatMessages
      })
    });

    const data = await aiRes.json();

    if (!aiRes.ok) {
      console.error('Groq API error:', JSON.stringify(data));

      return res.status(500).json({
        error:
          data?.error?.message ||
          'Gagal memproses AI di server.'
      });
    }

    const replyText =
      data?.choices?.[0]?.message?.content ||
      'Maaf, aku belum bisa jawab itu sekarang. Coba tanya dengan cara lain ya.';

    return res.status(200).json({
      reply: replyText
    });

  } catch (error) {
    console.error('Recovra AI error:', error);

    return res.status(500).json({
      error: 'Gagal memproses AI di server.'
    });
  }
};