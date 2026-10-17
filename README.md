# UdaKids

Aplikasi web belajar untuk anak SD Kelas 1 sampai 4. Anak berlatih Matematika dan Sains per topik dan level, ditemani robot
Momo yang membacakan soal. Orang tua memantau perkembangan anak, membeli paket, dan mengunduh sertifikat. Admin mengelola
konten, keluarga, transaksi, Premium, sertifikat, dan pengaturan aplikasi.

## Fitur rilis 1.0

- **Anak:** masuk dengan kode keluarga dan sandi 3 gambar, Peta Belajar Kelas 1 sampai 4 (Matematika Kelas 1 sampai 4,
  Sains Kelas 1), ronde 10 soal yang dibacakan dan langsung dinilai saat diketuk, umpan balik ramah anak, tanaman Skor
  Jago, papan peringkat, profil, dan sertifikat.
- **Orang tua:** daftar, kelola sampai 3 profil anak, dasbor dan laporan per anak, paket dengan pembayaran transfer manual,
  riwayat transaksi, akun, dan menu Sertifikat.
- **Admin:** menu dikelompokkan menjadi Konten & Kurikulum (Silabus Belajar untuk menambah buku, topik, dan level lengkap dengan soal tulisan sendiri serta
  mengatur level gratis, Bank Soal & Latihan sebagai simulator kuis, Sertifikat Juara), Media & Audio (Galeri Aset, Audio Narasi, Ilustrasi AI), Pengguna & Akademik (Keluarga & Anak, Tim
  Staf & Akses, Laporan & Rapor Belajar), dan Langganan & Pembayaran (Transaksi & Bukti Bayar, Paket Langganan, Rekening &
  Pembayaran, Pengaturan Sistem), ditambah Ringkasan bergrafik dan notifikasi.
- **Paket:** 5 paket awal (Tunas, Kumbang, Tumbuh Bersama, Bintang Kecil, Teman Setia); admin bisa mengubah dan menambah.
  Awalnya level 1 dan 2 tiap topik gratis, level berikutnya Premium untuk semua anak di keluarga itu; batasnya diatur di
  Silabus Belajar.
- **Sertifikat Juara Digital:** terbit otomatis dengan nomor `CERT-XXXXXX` saat anak Premium lulus semua level satu buku.
  Bisa dicetak, disimpan sebagai PDF, atau diunduh sebagai gambar PNG. Orang tua boleh mengisi nama lengkap anak khusus
  untuk sertifikat (dengan persetujuan), kode QR di lembar membuka halaman cek keaslian yang menyamarkan nama, dan isi
  lembar (penerbit, judul, penanda tangan, kurikulum, skor) diatur admin, termasuk tanda tangan (goresan bawaan, ditulis di
  kanvas, atau foto/scan dengan latar yang dibersihkan otomatis) dan stempel digital (segel emas bawaan, stempel yang pernah
  diunggah, atau gambar stempel baru). Admin memilih desain (Kuning, Merah, atau Hijau) dan menerbitkan sertifikat yang
  tertunda.
- **Suara:** setiap halaman anak membacakan isinya, tombol menyebut namanya saat diketuk; simbol matematika (`>`, `<`, `=`,
  `+`, `-`, `×`, `÷`) dibacakan sebagai kata bahasa Indonesia.

## Status

Semua tampilan tiga peran berjalan penuh dengan data tiruan di browser (mode mock, disimpan di `localStorage`). API NestJS
dan PostgreSQL dibangun mulai M6 dengan kontrak yang sudah ditulis di `packages/engine/src/schemas`. Rencana lengkap ada di
[PRD.md](PRD.md) bagian 12.

## Teknologi

Monorepo pnpm berbasis TypeScript: React 18 + Vite di `apps/web`, `packages/engine` berisi skema, generator soal,
penilaian, dan aturan paket serta sertifikat yang dipakai bersama web dan server, dan `apps/api` (NestJS 11 + Drizzle +
PostgreSQL, mulai M6).

| Folder            | Isi                                                                 |
| ----------------- | ------------------------------------------------------------------- |
| `apps/web`        | Aplikasi web: area anak, orang tua, admin, landing, data tiruan     |
| `packages/engine` | Skema Zod, generator soal ber-seed, penilaian, peringkat, sertifikat |
| `content/`        | Buku, topik, level, materi, serta paket dan rekening (`billing.json`) |
| `scripts/`        | Validasi konten dan impor spesifikasi soal                          |

## Menjalankan

```bash
corepack enable
pnpm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
pnpm dev                  # web http://localhost:6006
```

`VITE_MOCK_MODULES=*` (bawaan) membuat semua modul memakai data tiruan. Saat pertama dibuka, aplikasi memuat **data
contoh** (49 keluarga, sekitar 97 anak, 31 staf, sekitar 100 transaksi, ribuan ronde, sertifikat, dan ilustrasi) supaya
semua halaman bisa dicoba dengan isi yang ramai. Data contoh bisa dimuat ulang dengan tanggal hari ini atau dihapus di
admin, **Pengaturan Sistem → Data contoh**; data buatan sendiri tidak ikut terhapus. Untuk mengulang semua data, buka
`http://localhost:6006/gaya` lalu klik "Setel ulang data tiruan".

## Akun demo (mode mock)

| Peran     | Cara masuk                                                                            |
| --------- | ------------------------------------------------------------------------------------- |
| Anak      | `/play/masuk`, kode `RWJUVF`, Ayu (apel, bintang, ikan) atau Bima (bola, awan, daun)   |
| Orang tua | `/orang-tua/masuk`, `ridhodwi330@gmail.com` / `rahasia123`                            |
| Admin     | `/masuk/staf`, `admin@udakids.local` / `admin12345`                                   |
| Anak (data contoh) | kode `CERDAS`: Nara (apel, bintang, ikan) sudah punya sertifikat Matematika Kelas 1, Sakti (bola, awan, daun), Lili (kucing, rumah, bunga) |
| Orang tua (data contoh) | `rina.kusumawati@example.com` / `rahasia123` (12 transaksi); orang tua contoh lain juga memakai `rahasia123` |
| Staf (data contoh) | mis. `nadia.paramitha@udakids.local` / `staf12345`                               |

Untuk mencoba sertifikat tanpa memainkan semua level, buka `/gaya` (hanya saat `pnpm dev`) lalu klik "Demo sertifikat"
(Ayu menuntaskan Matematika Kelas 1 dengan Premium) atau "Demo menunggu" (Bima menuntaskan Sains Kelas 1 tanpa Premium,
muncul di daftar Menunggu admin).

## Perintah

| Perintah                | Fungsi                                              |
| ----------------------- | --------------------------------------------------- |
| `pnpm dev`              | Membangun engine lalu menjalankan web               |
| `pnpm lint`             | ESLint dan pemeriksaan format Prettier              |
| `pnpm format`           | Merapikan format                                    |
| `pnpm typecheck`        | Pemeriksaan tipe semua paket                        |
| `pnpm test`             | Test engine (coverage ≥ 90%) dan web                |
| `pnpm validate:content` | Memeriksa semua buku di `content/`                  |
| `pnpm build`            | Build engine dan web                                |

## Dokumen

| Dokumen          | Isi                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------- |
| [PRD.md](PRD.md) | Produk: fitur, aturan nilai dan sertifikat, alur, halaman, tampilan, database, keamanan, rencana |
