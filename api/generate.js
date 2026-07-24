// api/generate.js
// Vercel Serverless Function — menjembatani frontend ke Google Gemini API (tingkatan gratis).
// API key TIDAK PERNAH dikirim ke browser; disimpan sebagai Environment Variable
// bernama GEMINI_API_KEY di dashboard Vercel (Project Settings → Environment Variables).
// Dapatkan API key gratis di https://aistudio.google.com/apikey (tanpa kartu kredit).

// Model: gemini-flash-latest — alias resmi Google yang OTOMATIS diarahkan ke
// model Flash terbaru yang masih tersedia untuk tingkatan gratis. Sengaja pakai
// alias ini (bukan versi statis seperti 'gemini-2.5-flash') supaya kode ini tidak
// perlu diubah lagi setiap kali Google memensiunkan versi model tertentu.
const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

const SYSTEM_PROMPT = [
  'Kamu adalah asisten guru Indonesia yang ahli membuat materi ajar berdiferensiasi sesuai Kurikulum Merdeka.',
  'Tugasmu: ubah SATU teks narasi menjadi TIGA versi dengan tingkat kesulitan berbeda, untuk kelas dan mata pelajaran yang diberikan.',
  '',
  'Tiga versi yang harus dibuat:',
  '1. SEDERHANA (kode 2B) — untuk siswa yang butuh dukungan lebih. Kalimat pendek, kosakata sehari-hari, struktur jelas.',
  '2. STANDAR (kode HB) — untuk siswa rata-rata di kelas. Mendekati kompleksitas teks asli, kosakata standar sesuai jenjang.',
  '3. PENGAYAAN (kode 4H) — untuk siswa yang sudah mahir. Kosakata lebih kaya, struktur kalimat lebih kompleks, tetap sesuai konteks usia.',
  '',
  'Setiap permintaan akan disertai info "Fase Kurikulum Merdeka" beserta panduan kompleksitas kalimatnya (lihat pesan pengguna). Panduan fase itu adalah BASELINE kompleksitas bahasa untuk kelas tersebut — gunakan sebagai acuan utama, lalu terapkan tiga tingkatan (2B/HB/4H) SEBAGAI VARIASI DI SEKITAR baseline itu, bukan menyimpang jauh darinya. Contoh: untuk Fase A, ketiga versi tetap dalam batas kalimat pendek anak kelas 1-2 SD — 4H (pengayaan) di Fase A tetap jauh lebih sederhana dari 2B di Fase F.',
  '',
  'Jaga agar total ketiga versi ringkas.',
  '',
  'ATURAN FORMAT TEKS: Tulis setiap versi sebagai teks polos (plain text) karena hasilnya akan dicetak langsung. JANGAN gunakan markdown sama sekali — tidak ada tanda bintang (**tebal**), tidak ada tanda pagar (# judul), tidak ada bullet list dengan tanda -. Pisahkan setiap paragraf dengan DUA baris kosong (\\n\\n) di dalam string.'
].join('\n');

const FASE_MAP = {
  'Kelas 1 SD': 'A', 'Kelas 2 SD': 'A',
  'Kelas 3 SD': 'B', 'Kelas 4 SD': 'B',
  'Kelas 5 SD': 'C', 'Kelas 6 SD': 'C',
  'Kelas 7 SMP': 'D', 'Kelas 8 SMP': 'D', 'Kelas 9 SMP': 'D',
  'Kelas 10 SMA': 'E',
  'Kelas 11 SMA': 'F', 'Kelas 12 SMA': 'F'
};
const FASE_DESC = {
  A: 'Fase A (kelas 1–2 SD): kalimat sangat pendek (5–8 kata), satu gagasan per kalimat, kosakata konkret sehari-hari, hindari istilah abstrak dan anak kalimat.',
  B: 'Fase B (kelas 3–4 SD): kalimat pendek-sedang (8–12 kata), kosakata sehari-hari dengan sedikit istilah sekolah, boleh kalimat majemuk sangat sederhana.',
  C: 'Fase C (kelas 5–6 SD): kalimat sedang (10–15 kata), istilah teknis dasar mata pelajaran boleh dipakai dengan penjelasan singkat, kalimat majemuk setara/bertingkat sederhana.',
  D: 'Fase D (kelas 7–9 SMP): kalimat sedang-kompleks, istilah teknis mata pelajaran dipakai lebih bebas, struktur sebab-akibat dan perbandingan diperbolehkan.',
  E: 'Fase E (kelas 10 SMA): kalimat kompleks, istilah teknis/akademik dipakai wajar, penalaran berlapis dan kaitan ke konsep lain dalam bidang studi.',
  F: 'Fase F (kelas 11–12 SMA): kalimat kompleks dan padat, istilah akademik/khusus dipakai bebas, penalaran abstrak, argumentasi berlapis, gaya mendekati teks rujukan akademik.'
};

function buildUserPrompt(kelas, mapel, judul, teks) {
  const fase = FASE_MAP[kelas] || null;
  const faseLine = fase
    ? 'Fase Kurikulum Merdeka: ' + fase + ' — ' + FASE_DESC[fase]
    : 'Fase Kurikulum Merdeka: (tidak diketahui, gunakan pertimbangan usia dari nama kelas)';
  return 'Kelas: ' + kelas + '\n' +
    faseLine + '\n' +
    'Mata pelajaran: ' + (mapel || '(tidak disebutkan)') + '\n' +
    'Judul materi: ' + (judul || '(tidak disebutkan)') + '\n\n' +
    'Teks narasi asli:\n' + teks;
}

// Skema ini memaksa Gemini mengembalikan JSON valid dengan struktur ini persis —
// tidak perlu lagi parsing manual / jaga-jaga markdown code fence.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sederhana: { type: 'STRING' },
    standar: { type: 'STRING' },
    pengayaan: { type: 'STRING' }
  },
  required: ['sederhana', 'standar', 'pengayaan']
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY belum diatur di Environment Variables Vercel.' });
    return;
  }

  const { kelas, mapel, judul, teks } = req.body || {};

  if (!kelas || typeof kelas !== 'string') {
    res.status(400).json({ error: 'Kelas wajib diisi.' });
    return;
  }
  if (!teks || typeof teks !== 'string' || teks.trim().length < 20) {
    res.status(400).json({ error: 'Teks narasi minimal 20 karakter.' });
    return;
  }

  try {
    const geminiRes = await fetch(GEMINI_URL + '?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: buildUserPrompt(kelas, mapel, judul, teks) }] }
        ],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      // 429 = kena batas kuota gratis (permintaan per menit/hari) — beri pesan yang jelas untuk pengguna.
      if (geminiRes.status === 429) {
        res.status(429).json({ error: 'Sedang banyak yang memakai layanan gratis ini. Coba lagi dalam beberapa menit.' });
        return;
      }
      // 404 dari Gemini biasanya berarti nama model sudah tidak berlaku lagi (Google sering mengganti/mempensiunkan model).
      if (geminiRes.status === 404) {
        res.status(502).json({ error: 'Model AI yang dipakai sudah tidak tersedia lagi dari Google. Pengelola aplikasi perlu memperbarui GEMINI_MODEL di api/generate.js.' });
        return;
      }
      res.status(geminiRes.status).json({ error: 'Gemini API error: ' + JSON.stringify(data) });
      return;
    }

    const candidate = data && data.candidates && data.candidates[0];
    const text = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;

    if (!text) {
      res.status(502).json({ error: 'Jawaban AI kosong atau diblokir oleh filter keamanan konten.' });
      return;
    }

    if (candidate.finishReason === 'MAX_TOKENS') {
      res.status(502).json({ error: 'Naskah sumber terlalu panjang sehingga jawaban AI terpotong. Coba persingkat naskahnya, lalu proses lagi.' });
      return;
    }

    let hasil;
    try {
      hasil = JSON.parse(text);
    } catch (parseErr) {
      res.status(502).json({ error: 'Jawaban AI terpotong atau tidak lengkap. Coba tekan tombol proses sekali lagi, atau persingkat naskah sumbernya.' });
      return;
    }

    if (!hasil.sederhana || !hasil.standar || !hasil.pengayaan) {
      res.status(502).json({ error: 'Jawaban AI tidak lengkap (ada level yang hilang).' });
      return;
    }

    res.status(200).json(hasil);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Terjadi kesalahan tak terduga di server.' });
  }
};
