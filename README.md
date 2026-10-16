# UdaKids

Aplikasi web belajar untuk anak SD Kelas 1 sampai 4. Anak berlatih Matematika dan Sains per topik dan level, ditemani robot
Momo yang membacakan soal. Orang tua memantau perkembangan anak, membeli paket, dan mengunduh sertifikat. Admin mengelola
konten, pengguna, transaksi, Premium, dan sertifikat.

## Fitur rilis 1.0

- **Anak:** masuk dengan kode keluarga dan sandi 3 gambar, Peta Belajar Kelas 1 sampai 4 (Matematika Kelas 1 sampai 4,
  Sains Kelas 1), ronde 10 soal yang dibacakan dan langsung dinilai saat diketuk, umpan balik ramah anak, tanaman Skor
  Jago, papan peringkat, profil, dan sertifikat.
- **Orang tua:** daftar, kelola sampai 3 profil anak, dasbor dan laporan per anak, paket dengan pembayaran transfer manual,
  riwayat transaksi, akun, dan menu Sertifikat.
- **Admin:** konten, pratinjau soal generator, asisten AI untuk draf materi, pengguna dan Premium, laporan, transaksi,
  paket, rekening, dan sertifikat.
- **Paket:** 5 paket (Tunas, Kumbang, Tumbuh Bersama, Bintang Kecil, Teman Setia). Level 1 dan 2 tiap topik gratis, level
  3 dan 4 Premium untuk semua anak di keluarga itu.
- **Sertifikat Juara Digital:** terbit otomatis dengan nomor `CERT-XXXXXX` saat anak Premium lulus semua level satu buku.
  Bisa dicetak, disimpan sebagai PDF, atau diunduh sebagai gambar PNG. Admin memilih desain dan menerbitkan sertifikat
  yang tertunda.
- **Suara:** setiap halaman anak membacakan isinya, tombol menyebut namanya saat diketuk.

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

`VITE_MOCK_MODULES=*` (bawaan) membuat semua modul memakai data tiruan. Untuk mengulang data, buka
`http://localhost:6006/gaya` lalu klik "Setel ulang data tiruan".

## Akun demo (mode mock)

| Peran     | Cara masuk                                                                            |
| --------- | ------------------------------------------------------------------------------------- |
| Anak      | `/play/masuk`, kode `RWJUVF`, Ayu (apel, bintang, ikan) atau Bima (bola, awan, daun)   |
| Orang tua | `/orang-tua/masuk`, `ridhodwi330@gmail.com` / `rahasia123`                            |
| Admin     | `/masuk/staf`, `admin@udakids.local` / `admin12345`                                   |

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
