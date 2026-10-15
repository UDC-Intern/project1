# UdaKids

Aplikasi web belajar untuk anak SD kelas awal. Anak berlatih Matematika dan Sains per topik dan level, ditemani robot Momo
yang membacakan soal. Orang tua memantau perkembangan anak, dan admin mengelola konten, pengguna, serta akses Premium.


## Fitur rilis 1.0

- **Anak:** masuk dengan kode keluarga dan sandi 3 gambar, buku Kelas 1 Matematika dan Sains, ronde 5 soal yang dibacakan,
  umpan balik ramah anak, tanaman Skor Jago per topik, papan peringkat, profil.
- **Orang tua:** daftar, kelola sampai 3 profil anak, laporan per topik, ringkasan mingguan, status paket.
- **Admin:** kelola buku, topik, level, dan bank soal; AI pembuat soal dengan tinjauan sebelum tayang; pengguna dan Premium;
  laporan anak dan statistik level.
- **Suara:** soal dan materi dibacakan dengan Google Cloud Text-to-Speech, disimpan sekali di database.

## Teknologi

Monorepo pnpm berbasis TypeScript: React 18 + Vite di `apps/web`, NestJS 11 + Drizzle + PostgreSQL di `apps/api`, dan
`packages/engine` berisi logika penilaian yang dipakai bersama web dan server. Rincian di

## Menjalankan (setelah M1)

```bash
corepack enable
pnpm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
pnpm dev                  # web http://localhost:6006, API http://localhost:7177 (mulai M6)
```

Database (mulai M6): isi `DATABASE_URL` di `.env`, lalu `pnpm db:setup`.

## Dokumen

| Dokumen                                      | Isi                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| [PRD.md](PRD.md)                             | Produk: fitur, alur, halaman, tampilan, database, keamanan, asumsi     |
| [CLAUDE.md](CLAUDE.md)                       | Aturan kerja untuk Claude Code                                         |

## Acuan

Dikembangkan dalam program MBKM di Udacoding. Arsitektur dan aturan produk mengacu pada platform UdaKids milik Udacoding
