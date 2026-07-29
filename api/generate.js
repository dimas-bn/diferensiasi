// api/generate.js
// Vercel Serverless Function — menjembatani frontend ke AI (Gemini utama, Groq cadangan).
// API key TIDAK PERNAH dikirim ke browser; disimpan sebagai Environment Variables di
// dashboard Vercel (Project Settings → Environment Variables):
//   - GEMINI_API_KEY (wajib)  — https://aistudio.google.com/apikey (tanpa kartu kredit)
//   - GROQ_API_KEY   (opsional, untuk fitur cadangan otomatis) — https://console.groq.com/keys

// Model Gemini: alias resmi Google, otomatis diarahkan ke versi Flash terbaru yang
// masih tersedia untuk tingkatan gratis — supaya kode ini tidak perlu diubah lagi
// setiap kali Google memensiunkan versi model tertentu.
const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

// Model cadangan di Groq: Llama 3.3 70B — kualitas setara model besar, jauh lebih cepat,
// gratis tanpa kartu kredit. Dipakai HANYA kalau Gemini gagal karena masalah sementara
// di sisi Google (kuota habis / server bermasalah / model dipensiunkan).
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

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
  'ATURAN FORMAT TEKS: Tulis setiap versi sebagai teks polos (plain text) karena hasilnya akan dicetak langsung. JANGAN gunakan markdown sama sekali — tidak ada tanda bintang (**tebal**), tidak ada tanda pagar (# judul), tidak ada bullet list dengan tanda -. Pisahkan setiap paragraf dengan DUA baris kosong (\\n\\n) di dalam string.',
  '',
  'Jawab HANYA dengan JSON murni, tanpa teks pembuka, tanpa markdown code fence, persis format ini:',
  '{"sederhana":"...","standar":"...","pengayaan":"..."}'
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

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sederhana: { type: 'STRING' },
    standar: { type: 'STRING' },
    pengayaan: { type: 'STRING' }
  },
  required: ['sederhana', 'standar', 'pengayaan']
};

function isHasilLengkap(hasil) {
  return !!(hasil && hasil.sederhana && hasil.standar && hasil.pengayaan);
}

// ---------------------------------------------------------------------------
// Percobaan #1: Gemini (utama)
// Mengembalikan { ok:true, hasil } kalau berhasil, atau
// { ok:false, retryable, status, error } kalau gagal.
// `retryable` = true berarti wajar dicoba ulang lewat penyedia lain (masalah
// sementara di sisi Google) — bukan bug di permintaan kita atau blokir konten.
// ---------------------------------------------------------------------------
async function cobaGemini(kelas, mapel, judul, teks) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, retryable: true, status: 500, error: 'GEMINI_API_KEY belum diatur.' };
  }

  let geminiRes, data;
  try {
    geminiRes = await fetch(GEMINI_URL + '?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildUserPrompt(kelas, mapel, judul, teks) }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA
        }
      })
    });
    data = await geminiRes.json();
  } catch (err) {
    return { ok: false, retryable: true, status: 500, error: 'Gagal menghubungi Gemini: ' + (err.message || err) };
  }

  if (!geminiRes.ok) {
    if (geminiRes.status === 429) {
      return { ok: false, retryable: true, status: 429, error: 'Kuota gratis Gemini sedang penuh.' };
    }
    if (geminiRes.status === 404) {
      return { ok: false, retryable: true, status: 404, error: 'Model Gemini yang dipakai sudah tidak tersedia lagi dari Google.' };
    }
    if (geminiRes.status === 400) {
      return { ok: false, retryable: false, status: 400, error: 'Permintaan ditolak Google (format tidak didukung model saat ini). Detail: ' + JSON.stringify(data) };
    }
    if (geminiRes.status >= 500) {
      return { ok: false, retryable: true, status: geminiRes.status, error: 'Server Gemini sedang bermasalah.' };
    }
    return { ok: false, retryable: false, status: geminiRes.status, error: 'Gemini API error: ' + JSON.stringify(data) };
  }

  const candidate = data && data.candidates && data.candidates[0];

  const blockReason = data && data.promptFeedback && data.promptFeedback.blockReason;
  if (blockReason) {
    // Ini keputusan filter keamanan, BUKAN masalah sementara — sengaja tidak retryable,
    // supaya tidak "loncat" ke penyedia lain hanya untuk mengakali filter konten.
    return { ok: false, retryable: false, status: 422, error: 'Naskah ini tidak bisa diproses karena tersaring oleh filter keamanan otomatis Google (kode: ' + blockReason + '). Coba tulis ulang bagian yang mungkin dianggap sensitif, misalnya kalimat yang menyinggung kekerasan, isu tubuh manusia, atau topik dewasa — meski konteksnya materi pelajaran yang sah.' };
  }
  if (candidate && candidate.finishReason === 'SAFETY') {
    return { ok: false, retryable: false, status: 422, error: 'Sebagian jawaban AI tersaring oleh filter keamanan otomatis Google. Coba sesuaikan redaksi naskah sumber (biasanya dipicu oleh topik kekerasan, isu tubuh manusia, atau tema dewasa), lalu proses lagi.' };
  }

  const text = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;
  if (!text) {
    return { ok: false, retryable: true, status: 502, error: 'Jawaban Gemini kosong tanpa keterangan penyebab yang jelas.' };
  }
  if (candidate.finishReason === 'MAX_TOKENS') {
    // Bukan masalah penyedia, jadi tidak perlu coba penyedia lain — pesannya spesifik ke pengguna.
    return { ok: false, retryable: false, status: 502, error: 'Naskah sumber terlalu panjang sehingga jawaban AI terpotong. Coba persingkat naskahnya, lalu proses lagi.' };
  }

  let hasil;
  try {
    hasil = JSON.parse(text);
  } catch (parseErr) {
    return { ok: false, retryable: true, status: 502, error: 'Jawaban Gemini terpotong atau tidak valid.' };
  }

  if (!isHasilLengkap(hasil)) {
    return { ok: false, retryable: true, status: 502, error: 'Jawaban Gemini tidak lengkap (ada level yang hilang).' };
  }

  return { ok: true, hasil: hasil };
}

// ---------------------------------------------------------------------------
// Percobaan #2: Groq (cadangan) — dipanggil HANYA kalau Gemini gagal dengan
// alasan retryable, dan GROQ_API_KEY sudah dipasang oleh pengelola.
// ---------------------------------------------------------------------------
async function cobaGroq(kelas, mapel, judul, teks) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, retryable: false, status: 500, error: 'GROQ_API_KEY belum diatur (fitur cadangan tidak aktif).' };
  }

  let groqRes, data;
  try {
    groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.6,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(kelas, mapel, judul, teks) }
        ]
      })
    });
    data = await groqRes.json();
  } catch (err) {
    return { ok: false, retryable: true, status: 500, error: 'Gagal menghubungi Groq: ' + (err.message || err) };
  }

  if (!groqRes.ok) {
    if (groqRes.status === 429 || groqRes.status >= 500) {
      return { ok: false, retryable: true, status: groqRes.status, error: 'Groq sedang sibuk/kena batas kuota.' };
    }
    return { ok: false, retryable: false, status: groqRes.status, error: 'Groq API error: ' + JSON.stringify(data) };
  }

  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) {
    return { ok: false, retryable: false, status: 502, error: 'Jawaban Groq kosong.' };
  }

  let hasil;
  try {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
    hasil = JSON.parse(start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned);
  } catch (parseErr) {
    return { ok: false, retryable: false, status: 502, error: 'Jawaban Groq terpotong atau tidak valid.' };
  }

  if (!isHasilLengkap(hasil)) {
    return { ok: false, retryable: false, status: 502, error: 'Jawaban Groq tidak lengkap (ada level yang hilang).' };
  }

  return { ok: true, hasil: hasil };
}

// ---------------------------------------------------------------------------
// Retry otomatis untuk error sementara.
// Mengulang fungsi `fn` sampai `percobaanMax` kali TOTAL (percobaan pertama +
// retry), dengan jeda singkat (backoff) di antaranya. Berhenti lebih awal kalau
// berhasil, atau kalau errornya bukan jenis yang wajar dicoba ulang (retryable
// = false) — misalnya diblokir filter keamanan atau naskah terlalu panjang,
// karena mencoba ulang tidak akan mengubah hasilnya.
// ---------------------------------------------------------------------------
function tunggu(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function denganRetry(fn, percobaanMax, jedaMs) {
  let hasilTerakhir;
  for (let i = 0; i < percobaanMax; i++) {
    hasilTerakhir = await fn();
    if (hasilTerakhir.ok || !hasilTerakhir.retryable) {
      return hasilTerakhir;
    }
    if (i < percobaanMax - 1) {
      await tunggu(jedaMs * (i + 1)); // backoff bertahap: 1x jeda, lalu 2x jeda, dst.
    }
  }
  return hasilTerakhir;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
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
  if (teks.length > 3000) {
    res.status(400).json({ error: 'Teks narasi maksimal 3000 karakter.' });
    return;
  }

  // Gemini: coba sampai 3 kali total (1 percobaan awal + 2 retry) kalau gagalnya
  // karena masalah sementara — jeda 1 detik, lalu 2 detik.
  const gemini = await denganRetry(function () {
    return cobaGemini(kelas, mapel, judul, teks);
  }, 3, 1000);

  if (gemini.ok) {
    res.status(200).json(Object.assign({}, gemini.hasil, { _engine: 'gemini' }));
    return;
  }

  // Gemini gagal setelah dicoba ulang. Kalau alasannya bukan masalah sementara
  // (mis. filter keamanan, atau naskah terlalu panjang), langsung sampaikan
  // pesannya apa adanya — retry maupun ganti penyedia tidak akan mengubah hasil.
  if (!gemini.retryable) {
    res.status(gemini.status || 502).json({ error: gemini.error });
    return;
  }

  // Gemini tetap gagal setelah retry — diam-diam coba Groq sebagai cadangan
  // (juga dengan retry singkat), kalau pengelola sudah memasang GROQ_API_KEY.
  if (process.env.GROQ_API_KEY) {
    const groq = await denganRetry(function () {
      return cobaGroq(kelas, mapel, judul, teks);
    }, 2, 1000);

    if (groq.ok) {
      res.status(200).json(Object.assign({}, groq.hasil, { _engine: 'groq' }));
      return;
    }
    // Groq (cadangan) juga gagal — tampilkan pesan Gemini (penyedia utama) yang
    // biasanya lebih mudah dipahami, karena sudah dipetakan ke pesan ramah pengguna.
    res.status(gemini.status || 502).json(mapGeminiErrorToUser(gemini));
    return;
  }

  // Tidak ada Groq terpasang — tampilkan pesan Gemini yang sudah dipetakan ramah pengguna.
  res.status(gemini.status || 502).json(mapGeminiErrorToUser(gemini));
};

// Memetakan status Gemini ke pesan yang sudah dipakai di versi-versi sebelumnya,
// supaya pengalaman pengguna tetap konsisten kalau memang tidak ada cadangan.
function mapGeminiErrorToUser(gemini) {
  if (gemini.status === 429) {
    return { error: 'Sedang banyak yang memakai layanan gratis ini. Coba lagi dalam beberapa menit.' };
  }
  if (gemini.status === 404) {
    return { error: 'Model AI yang dipakai sudah tidak tersedia lagi dari Google. Pengelola aplikasi perlu memperbarui GEMINI_MODEL di api/generate.js.' };
  }
  return { error: gemini.error };
}
