# Deploy "Diferensiasi" ke Vercel — Versi Gratis (Google Gemini)

Struktur folder ini sudah siap deploy:

```
diferensiasi-vercel/
├── index.html        ← tampilan aplikasi (frontend)
└── api/
    └── generate.js    ← fungsi server yang menyimpan API key & memanggil Gemini
```

Frontend memanggil `/api/generate` (bukan Google langsung), dan `api/generate.js`
menyimpan API key dengan aman di server lalu meneruskan permintaan ke **Google Gemini API**.
Dengan begini, API key **tidak pernah terlihat** oleh pengunjung situs, dan seluruh
alur ini **tidak membutuhkan kartu kredit maupun biaya apa pun** — selama masih dalam
batas kuota gratis (lihat bagian "Batasan Kuota Gratis" di bawah).

## 1. Ambil API key Gemini (gratis, tanpa kartu kredit)

1. Buka [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Login dengan akun Google apa saja.
3. Klik **Create API key**, pilih atau buat project baru.
4. Salin API key yang muncul.

Tidak perlu mengisi data kartu kredit atau billing untuk langkah ini.

## 2. Deploy ke Vercel

**Lewat dashboard (paling mudah, tanpa command line):**

1. Buka [vercel.com](https://vercel.com) → login/daftar (gratis, plan Hobby).
2. Klik **Add New → Project**.
3. Upload folder `diferensiasi-vercel` ini (atau hubungkan ke repo GitHub jika Anda
   sudah mengunggahnya ke GitHub — cara ini lebih mudah untuk update di kemudian hari).
4. Saat proses import, biarkan *Framework Preset* di **"Other"** — Vercel akan otomatis
   mengenali `index.html` sebagai halaman statis dan `api/generate.js` sebagai serverless function.
5. Sebelum menekan **Deploy**, buka bagian **Environment Variables**, tambahkan:
   - Name: `GEMINI_API_KEY`
   - Value: *(tempel API key dari langkah 1)*
6. Klik **Deploy**.

**Lewat Vercel CLI (kalau terbiasa terminal):**

```bash
npm i -g vercel
cd diferensiasi-vercel
vercel
vercel env add GEMINI_API_KEY
vercel --prod
```

## 3. Atur domain jadi diferensiasi.vercel.app

1. Di dashboard project → **Settings → Domains**.
2. Vercel otomatis memberi domain `nama-project.vercel.app` sesuai nama project saat import.
   Untuk mendapat persis `diferensiasi.vercel.app`, beri nama project **"diferensiasi"** saat
   import (langkah 2.3) — atau ganti nama project di **Settings → General → Project Name**
   lalu tambahkan domain tersebut di tab **Domains**.
3. Jika `diferensiasi.vercel.app` sudah dipakai akun lain, Vercel akan menyarankan
   nama alternatif (mis. `diferensiasi-xxxx.vercel.app`).

## 4. Uji coba

Buka domain yang sudah aktif, isi Panel A, tekan **"Proses 3 Rancangan Bacaan"**.
Jika muncul error `"GEMINI_API_KEY belum diatur..."`, cek kembali langkah 2.5.

---

## Batasan Kuota Gratis — Wajib Dibaca

Tingkatan gratis Gemini API (model `gemini-2.5-flash`) kira-kira dibatasi:

| Batas | Perkiraan angka |
|---|---|
| Permintaan per menit | ± 10–15 |
| Permintaan per hari | ± 250–1.500 |
| Token per menit | hingga 1 juta |

**Angka-angka ini bisa berubah sewaktu-waktu** — Google beberapa kali menyesuaikan
kuota gratisnya. Cek angka aktual & terkini di
[ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)
lewat akun Google yang sama dengan API key Anda (Google AI Studio menampilkan kuota
spesifik untuk project Anda).

**Apa yang terjadi kalau kuota habis?** Pengguna akan melihat pesan
*"Sedang banyak yang memakai layanan gratis ini. Coba lagi dalam beberapa menit."*
— bukan error mentah yang membingungkan. Kuota harian akan reset otomatis setiap
tengah malam waktu Pasifik AS (siang hari WIB berikutnya).

**Kalau kuota mulai sering habis** (tandanya aplikasi makin bermanfaat dan makin
banyak dipakai — kabar baik!), dua pilihan tanpa mengubah kode:
1. Ganti `GEMINI_MODEL` di `api/generate.js` dari `'gemini-2.5-flash'` menjadi
   `'gemini-2.5-flash-lite'` — kuota harian jauh lebih besar, kualitas sedikit lebih sederhana.
2. Aktifkan billing di Google AI Studio — harga Gemini Flash di luar kuota gratis
   termasuk yang termurah di pasaran (jauh lebih murah dari Claude atau GPT), jadi
   kalaupun suatu saat perlu berbayar, biayanya tetap sangat kecil dibanding trafiknya.

## Catatan Privasi

Di tingkatan gratis, Google berhak menggunakan teks yang dikirim (prompt) untuk
melatih/meningkatkan model mereka — ini beda dengan tingkatan berbayar yang datanya
tidak dipakai untuk pelatihan. Karena aplikasi ini memproses materi pelajaran umum
(bukan data pribadi siswa), risikonya kecil, tapi tetap baik untuk diketahui dan
disebutkan secara terbuka kalau ada yang bertanya.

## Catatan Keamanan

- Karena `api/generate.js` bisa dipanggil siapa saja yang membuka situs Anda,
  API key gratis ini dipakai bersama oleh semua pengunjung. Ini wajar untuk skema
  gratis-untuk-publik, tapi kalau ingin membatasi penyalahgunaan (bot spam, dsb.),
  beri tahu saya kalau ingin dibantu menambahkan pembatasan sederhana (mis. jeda antar
  klik, atau batas jumlah permintaan per pengunjung).
- Jangan pernah menaruh API key langsung di `index.html` atau file yang bisa diakses
  browser — selalu lewat Environment Variable seperti di atas.
