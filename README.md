# UdaKids

UdaKids adalah aplikasi belajar untuk anak SD kelas 1–4 dengan area anak, orang tua, dan admin. Monorepo ini berisi frontend React, backend NestJS, PostgreSQL/Drizzle, kurikulum di `content/`, dan aturan bersama di `packages/engine`.

## Menjalankan secara lokal

Gunakan Node.js 22.12 atau lebih baru dan pnpm 10. Dari PowerShell di folder repo:

```powershell
corepack enable
pnpm install
pnpm dev:local
```

`dev:local` membuat `.env` hanya jika file itu belum ada, memilih PGlite lokal, mengisi migrasi dan data kurikulum, lalu menjalankan web di `http://localhost:6006` dan API di `http://localhost:7177`. Data lokal tersimpan di `.data/development`. Ganti `ADMIN_PASSWORD` dan rahasia lain di `.env` sebelum memakai akun lokal untuk demo. Akun admin memakai `ADMIN_EMAIL` dan `ADMIN_PASSWORD` dari `.env`.

Untuk mengisi papan peringkat dan laporan dengan lima anak contoh melalui API lokal, biarkan `pnpm dev:local` berjalan lalu jalankan `pnpm db:demo` di terminal lain. Skrip hanya menerima `DATABASE_DRIVER=pglite`, membuat keluarga dan ronde latihan lewat backend, lalu memeriksa papan peringkat. Akses keluarga dan sandi gambar tersimpan di `.data/demo-access.json` (diabaikan Git). Jalankan ulang perintah ini dengan aman: ronde yang sudah dibuat tidak digandakan. Muat ulang halaman web untuk melihat hasilnya. Jangan gunakan akun demo untuk data sungguhan.

Untuk PostgreSQL, siapkan role dan database lebih dulu. Isi `DATABASE_URL`, `DATABASE_DRIVER=postgres`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, serta `WEB_ORIGIN` dalam `.env`, lalu jalankan:

```powershell
pnpm db:setup
pnpm dev
```

`pnpm dev` menjalankan API dan web dalam mode HTTP. `VITE_MOCK_MODULES` kosong pada konfigurasi lokal sehingga permintaan halaman diteruskan ke API. Mode demo lama dapat diaktifkan dengan `VITE_MOCK_MODULES=*`; mode itu memakai data browser terpisah.

## Pengaturan layanan

API memerlukan `JWT_SECRET` minimal 32 karakter. SMTP, OpenAI Images API, dan Google Cloud Text-to-Speech bersifat opsional dan hanya dipanggil oleh backend. Tanpa SMTP, email tersimpan di outbox menunggu konfigurasi SMTP. Tanpa kunci gambar/TTS, aplikasi tetap berjalan dan suara peramban tetap dapat dipakai.

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
| `pnpm db:demo` | Isi dan verifikasi data demo lewat API PGlite lokal |
| `pnpm db:backup` / `pnpm db:restore` | Backup/restore PostgreSQL melalui `pg_dump`/`pg_restore` |

`pnpm db:restore` meminta konfirmasi sebelum menimpa data tujuan. Untuk prosedur dan pembatasan produksi, baca [docs/backend.md](docs/backend.md).

## Batasan sebelum produksi

Belum ada VPS atau alamat publik yang dikonfigurasi. SMTP, gambar AI, dan suara Google belum diuji memakai kredensial sungguhan. Pengaktifan verifikasi email juga menunggu alur verifikasi pada UI. Detail keadaan dan gerbang pemeriksaan terakhir dicatat di [docs/plan.md](docs/plan.md).
