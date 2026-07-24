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
banyak dipakai — kabar baik!), atau kalau suatu saat muncul pesan
*"Model AI yang dipakai sudah tidak tersedia lagi dari Google..."* (Google memang
sering mengganti/mempensiunkan model), dua pilihan tanpa mengubah banyak kode:
1. Buka `api/generate.js`, ganti nilai `GEMINI_MODEL` — misalnya ke
   `'gemini-flash-lite-latest'` (kuota harian jauh lebih besar, kualitas sedikit
   lebih sederhana) — lalu unggah ulang ke Vercel.
2. Aktifkan billing di Google AI Studio — harga Gemini Flash di luar kuota gratis
   termasuk yang termurah di pasaran (jauh lebih murah dari Claude atau GPT), jadi
   kalaupun suatu saat perlu berbayar, biayanya tetap sangat kecil dibanding trafiknya.

> Kode ini sengaja memakai alias `gemini-flash-latest` (bukan versi statis seperti
> `gemini-2.5-flash`) karena Google terus memensiunkan versi lama dan meluncurkan
> versi baru. Alias ini otomatis diarahkan Google ke model Flash terbaru yang masih
> tersedia, jadi kemungkinan besar tidak akan mengalami error 404 "model tidak
> tersedia" lagi di kemudian hari.

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

---

## Antisipasi Masalah di Masa Depan

Tiga risiko berikut paling mungkin muncul seiring waktu — bukan karena ada yang salah
dengan kode, tapi karena sifat layanan gratis pihak ketiga yang terus berubah.

### 1. Google mengubah API Gemini (model, parameter, atau kuota)

**Kenapa ini bisa terjadi:** Gemini masih rutin merilis model baru dan memensiunkan
model lama — biasanya dalam hitungan bulan, kadang tanpa banyak pemberitahuan. Kita
sudah mengalami ini beberapa kali: model ditutup untuk akun baru (error 404), dan
parameter yang sebelumnya valid tiba-tiba ditolak model versi baru (error 400).

**Antisipasi yang sudah dipasang:**
- Kode memakai alias `gemini-flash-latest` (bukan versi statis) supaya Google otomatis
  mengarahkan ke model Flash yang masih aktif — mengurangi risiko error 404 "model tidak
  ditemukan", walau tidak menghapusnya sepenuhnya.
- Pesan error sekarang dipecah per jenis (404 = model pensiun, 400 = parameter ditolak,
  429 = kuota habis) sehingga kalau muncul lagi, penyebabnya langsung terlihat dari
  pesan errornya sendiri, tanpa perlu menebak-nebak.

**Yang perlu Anda lakukan kalau muncul lagi:**
1. Buka aplikasi, lihat pesan error yang muncul di layar (formatnya sekarang sudah jelas,
   menyebutkan jenis masalahnya).
2. Kalau pesannya menyebut "model tidak tersedia" atau "parameter ditolak", kirim
   screenshot ke saya seperti sebelumnya — biasanya perbaikannya hanya mengubah satu
   baris di `api/generate.js`.
3. Sesekali (mis. tiap beberapa bulan), boleh cek
   [ai.google.dev/gemini-api/docs/changelog](https://ai.google.dev/gemini-api/docs/changelog)
   untuk melihat ada perubahan besar atau tidak — tidak wajib, tapi membantu antisipasi
   dini sebelum ada laporan error dari pengguna.

### 2. Naskah tertentu diblokir filter keamanan otomatis Google

**Kenapa ini bisa terjadi:** Gemini punya filter keamanan konten otomatis yang kadang
terlalu sensitif untuk materi pendidikan yang sah — misalnya materi Biologi tentang
reproduksi manusia, Sejarah tentang perang/kekerasan, PJOK tentang penyakit tertentu,
atau materi Agama yang menyinggung topik lintas-keyakinan. Filter ini bekerja di luar
kendali kode aplikasi — sepenuhnya keputusan otomatis dari sistem Google.

**Antisipasi yang sudah dipasang:** kode sekarang mendeteksi dua bentuk pemblokiran
(ditolak sebelum diproses, atau jawabannya dipotong di tengah jalan) dan menampilkan
pesan yang menjelaskan penyebabnya ke pengguna secara langsung, lengkap dengan saran
untuk menyunting ulang bagian yang mungkin memicunya — tanpa pengguna perlu
menghubungi Anda dulu untuk tahu apa yang terjadi.

**Yang perlu Anda lakukan kalau ini terjadi:** umumnya tidak ada yang perlu diperbaiki
di kode — ini keputusan filter Google, bukan bug. Kalau ada guru yang melapor materi
sah ditolak berulang kali, sarankan menulis ulang kalimat yang kemungkinan memicunya
dengan istilah yang lebih netral.

### 5. Kuota gratis habis karena trafik ramai

**Kenapa ini bisa terjadi:** semua pengunjung situs berbagi satu kuota gratis yang sama
(lihat bagian "Batasan Kuota Gratis" di atas). Kalau aplikasi ini menyebar luas — yang
justru jadi tanda keberhasilan — kemungkinan besar kuota akan lebih sering habis di
jam-jam sibuk guru menyiapkan bahan ajar.

**Antisipasi yang sudah dipasang:** pesan error khusus (429) sudah ramah pengguna —
"Sedang banyak yang memakai layanan gratis ini. Coba lagi dalam beberapa menit." —
bukan error teknis yang membingungkan.

**Yang perlu Anda lakukan kalau ini mulai sering terjadi:**
1. Cek kuota aktual project Anda di Google AI Studio untuk memastikan ini benar
   soal kuota, bukan penyebab lain.
2. Pertimbangkan ganti `GEMINI_MODEL` ke `'gemini-flash-lite-latest'` (kuota harian
   jauh lebih besar, kualitas sedikit lebih sederhana) sebagai solusi cepat tanpa biaya.
3. Kalau trafiknya sudah besar dan konsisten, ini saat yang tepat mempertimbangkan
   opsi berbayar murah (harga Gemini Flash sangat terjangkau) atau skema donasi/sponsor
   dari komunitas guru yang terbantu — beri tahu saya kalau sampai di titik ini, saya
   bisa bantu hitung estimasi biayanya berdasarkan trafik aktual Anda.
