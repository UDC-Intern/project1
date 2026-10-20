# UdaKids

UdaKids adalah aplikasi belajar untuk anak SD kelas 1–4 dengan area anak, orang tua, dan admin. Monorepo ini berisi frontend React, backend NestJS, PostgreSQL/Drizzle, kurikulum di `content/`, dan aturan bersama di `packages/engine`.

## Menjalankan secara lokal

Gunakan Node.js 22.12 atau lebih baru dan pnpm 10. Dari PowerShell di folder repo:

```powershell
corepack enable
pnpm install
pnpm dev:local
```

`dev:local` membuat `.env` hanya jika file itu belum ada, memilih PGlite lokal, mengisi migrasi dan data kurikulum, lalu menjalankan web di `http://localhost:6006` dan API di `http://localhost:7177`. Data lokal tersimpan di `.data/development` atau folder `PGLITE_PATH` dalam `.env`. Ganti `ADMIN_PASSWORD` dan rahasia lain di `.env` sebelum memakai akun lokal untuk demo. Akun admin memakai `ADMIN_EMAIL` dan `ADMIN_PASSWORD` dari `.env`.

Untuk menyiapkan presentasi, biarkan `pnpm dev:local` berjalan lalu jalankan `pnpm db:demo` di terminal lain. Skrip hanya menerima `DATABASE_DRIVER=pglite` dan mengisi 24 keluarga, 74 anak (keluarga demo pertama berisi lima anak), lima admin demo di samping admin awal, latihan dan peringkat, transaksi, Premium, sertifikat, serta ilustrasi contoh. Batas awal lima anak per keluarga dapat diubah admin dari Pengaturan Sistem dan disimpan di tabel `app_settings` dengan kunci `family`. Semua akun keluarga demo memakai sandi `12345678`, lima admin demo memakai `admin123`, dan semua anak demo memakai sandi gambar apel–apel–apel. Contoh login: `demo.keluarga1@example.test`, kode keluarga dan profil anak di `.data/demo-access.json`, serta `demo.admin1@example.test`. Berkas akses diabaikan Git. Menjalankan ulang `pnpm db:demo` tidak menggandakan data, tetapi akan mengembalikan sandi akun demo ke sandi uji di atas, termasuk sandi yang pernah diubah. Muat ulang halaman web untuk melihat hasilnya. Jangan gunakan akun demo untuk data sungguhan.

Untuk PostgreSQL, siapkan role dan database lebih dulu. Isi `DATABASE_URL`, `DATABASE_DRIVER=postgres`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, serta `WEB_ORIGIN` dalam `.env`, lalu jalankan:

```powershell
pnpm db:setup
pnpm dev
```

`pnpm dev` menjalankan API dan web dalam mode HTTP. `VITE_MOCK_MODULES` kosong pada konfigurasi lokal sehingga permintaan halaman diteruskan ke API. Mode demo lama dapat diaktifkan dengan `VITE_MOCK_MODULES=*`; mode itu memakai data browser terpisah.

Menu Afiliasi orang tua menampilkan kode ajakan tersendiri, tautan `/r/KODE`, anggota langsung, saldo bonus/komisi, dan pengajuan pencairan. Admin melihat analisis, rincian afiliator, koreksi saldo, pemeriksaan rekening, pemrosesan pencairan, serta aturan program melalui `/admin/afiliasi`. Kode ajakan berbeda dari kode keluarga untuk masuk anak. Data demo pertama berisi klik tautan, tujuh anggota langsung, bonus tersedia, dan komisi tertahan.

## Pengaturan layanan

API memerlukan `JWT_SECRET` minimal 32 karakter. SMTP, OpenAI Images API, dan Google Cloud Text-to-Speech bersifat opsional dan hanya dipanggil oleh backend. Tanpa SMTP, email tersimpan di outbox menunggu konfigurasi SMTP. Tanpa kunci gambar/TTS, aplikasi tetap berjalan dan suara peramban tetap dapat dipakai.

Untuk mengirim email lewat Gmail, isi `SMTP_USER` dengan alamat pengirim, `SMTP_PASS` dengan App Password Google, biarkan `MAIL_FROM` kosong (pengirim mengikuti `SMTP_USER`), dan set `MAIL_WORKER=on` di `.env` yang tidak dilacak Git. Mulai ulang API, lalu uji pendaftaran menggunakan alamat email yang dapat dibuka. Setelah email uji benar-benar diterima, ubah `EMAIL_VERIFICATION=on` dan mulai ulang API lagi. Pendaftar baru akan menerima kode enam angka di `/orang-tua/verifikasi`; tanpa SMTP, biarkan verifikasi `off` agar pendaftaran tetap bisa dipakai. Status antrean tersedia untuk admin di `/api/admin/mail`.

Panduan konfigurasi lokal dan produksi ada di [docs/backend.md](docs/backend.md), kontrak rute ada di [docs/api/api.md](docs/api/api.md), dan skema tabel serta batas keamanan ada di [docs/architecture.md](docs/architecture.md). [docs/plan.md](docs/plan.md) mencatat implementasi dan pekerjaan yang belum dijalankan.

## Pemeriksaan dan perintah

| Perintah | Fungsi |
| --- | --- |
| `pnpm lint` | ESLint dan format Prettier |
| `pnpm typecheck` | Pemeriksaan tipe semua paket |
| `pnpm test` | Tes engine, web, dan API |
| `pnpm test:browser` | Alur browser terhadap API dan database memori terisolasi |
| `pnpm validate:content` | Validasi berkas konten kurikulum |
| `pnpm build` | Build engine, API, dan web |
| `pnpm db:generate` | Membuat migrasi dari perubahan skema |
| `pnpm db:setup` | Migrasi dan seed PostgreSQL |
| `pnpm db:demo` | Isi dan verifikasi data presentasi di PGlite lokal |
| `pnpm db:backup` / `pnpm db:restore` | Backup/restore PostgreSQL melalui `pg_dump`/`pg_restore` |

`pnpm db:restore` meminta konfirmasi sebelum menimpa data tujuan. Untuk prosedur dan pembatasan produksi, baca [docs/backend.md](docs/backend.md).

## Batasan sebelum produksi

Belum ada VPS atau alamat publik yang dikonfigurasi. SMTP, gambar AI, dan suara Google belum diuji memakai kredensial sungguhan. Verifikasi email sudah tersambung di UI, tetapi tetap `off` sampai pengiriman SMTP diuji. Detail keadaan dan gerbang pemeriksaan terakhir dicatat di [docs/plan.md](docs/plan.md).
